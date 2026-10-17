"""Deterministic MCP HTTP and scripted-model pipeline tests; no API keys needed."""
import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from backend.services.search import (
    MCP_URL, USER_AGENT, ParallelSearchClient, create_search_client,
    resolve_search_provider,
)
from backend.graph import Graph
from backend.nodes.curator import Curator
from backend.nodes.researchers.company import CompanyAnalyzer
from backend.nodes.researchers.financial import FinancialAnalyst


class MCPFixture:
    def __init__(self):
        self.requests = []
        self.mode = 'normal'
        self.started = asyncio.Event()
        self.cancelled = asyncio.Event()

    async def handle(self, request):
        self.requests.append(request)
        if request.method != 'POST':
            return httpx.Response(405)
        body = json.loads(request.content)
        if 'id' not in body:
            return httpx.Response(202)
        method = body['method']
        if method == 'initialize':
            result = {'protocolVersion': '2025-03-26', 'capabilities': {'tools': {}},
                      'serverInfo': {'name': 'fixture', 'version': '1.0'}}
        elif method == 'tools/list':
            result = {'tools': [
                {'name': name, 'inputSchema': {'type': 'object', 'properties': {}}}
                for name in ('web_search', 'web_fetch')
            ]}
        elif method == 'tools/call':
            self.started.set()
            if self.mode == 'wait':
                try:
                    await asyncio.Event().wait()
                finally:
                    self.cancelled.set()
            if self.mode == 'error':
                result = {'isError': True, 'content': [{'type': 'text', 'text': 'Search unavailable'}]}
            elif self.mode == 'malformed':
                result = {'content': [{'type': 'text', 'text': 'invalid JSON'}]}
            else:
                args = body['params']['arguments']
                if body['params']['name'] == 'web_search':
                    assert args['objective'] and len(args['search_queries']) >= 1
                    payload = {'results': [
                        {'url': 'https://example.com/ibm', 'title': 'IBM company', 'excerpts': ['IBM builds business technology.']},
                        {'url': 'https://example.com/news', 'title': 'IBM news', 'excerpts': ['IBM announced a new service.']},
                    ]}
                else:
                    assert args['full_content'] is True
                    payload = {'results': [{'url': url, 'full_content': 'IBM source page: business technology.'}
                                           for url in args['urls']]}
                result = {'structuredContent': payload, 'content': [{'type': 'text', 'text': json.dumps(payload)}]}
        else:
            raise AssertionError(method)
        return httpx.Response(200, json={'jsonrpc': '2.0', 'id': body['id'], 'result': result})

    def http_client(self, client):
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handle),
                                 headers={'User-Agent': USER_AGENT}, timeout=client.timeout)


class ScriptedModel:
    """Fixed model output tests data flow, not live WatsonX inference quality."""
    def __init__(self):
        self.prompts = []

    async def achat_stream(self, messages):
        is_query = 'You are researching' in messages[0]['content']
        content = 'IBM company services overview' if is_query else '# IBM\nIBM builds business technology.'
        async def chunks():
            yield {'choices': [{'delta': {'content': content}}]}
            yield {'choices': [{'finish_reason': 'stop'}]}
        return chunks()

    def generate_text(self, prompt):
        self.prompts.append(prompt)
        return 'IBM builds business technology.'

    async def achat(self, messages):
        return {'choices': [{'message': {'content': '# IBM\nIBM builds business technology.'}}]}


class SearchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.fixture = MCPFixture()
        fixture = self.fixture
        self.http_patch = patch.object(ParallelSearchClient, '_http_client', lambda client: fixture.http_client(client))
        self.http_patch.start()
        self.addCleanup(self.http_patch.stop)

    def assert_requests(self):
        self.assertTrue(self.fixture.requests)
        for request in self.fixture.requests:
            self.assertEqual(str(request.url), MCP_URL)
            self.assertEqual(request.headers['user-agent'], USER_AGENT)
            self.assertNotIn('authorization', request.headers)
        calls = [json.loads(r.content) for r in self.fixture.requests
                 if r.method == 'POST' and json.loads(r.content)['method'] == 'tools/call']
        self.assertEqual(len({c['params']['arguments']['session_id'] for c in calls}), 1)
        return calls

    async def test_full_graph_consumes_search_fetch_and_references(self):
        model = ScriptedModel()
        with patch('backend.nodes.researchers.base.ModelInference', return_value=model), \
             patch('backend.nodes.briefing.ModelInference', return_value=model), \
             patch('backend.nodes.editor.ModelInference', return_value=model):
            graph = Graph(company='IBM', url='https://example.com/ibm', industry='Technology',
                          tavily_client=create_search_client(), watsonx_client=object(), watsonx_project_id='project')
            updates = [update async for update in graph.run({})]
        curated = next(u['curator'] for u in updates if 'curator' in u)
        docs = curated['curated_company_data']
        self.assertEqual(list(docs), ['https://example.com/ibm', 'https://example.com/news'])
        self.assertEqual(docs['https://example.com/ibm']['title'], 'IBM company')
        self.assertIsNone(docs['https://example.com/ibm']['evaluation']['overall_score'])
        self.assertTrue(curated['references'])
        enriched = next(u['enricher'] for u in updates if 'enricher' in u)
        self.assertIn('IBM source page', enriched['curated_company_data']['https://example.com/ibm']['raw_content'])
        self.assertTrue(any('IBM source page' in prompt for prompt in model.prompts))
        self.assertIn('IBM builds business technology', updates[-1]['editor']['report'])
        calls = self.assert_requests()
        self.assertEqual({c['params']['name'] for c in calls}, {'web_search', 'web_fetch'})

    async def test_api_default_and_explicit_choices(self):
        import application
        with patch.object(application, 'process_research', new_callable=AsyncMock) as process:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application.app), base_url='http://test') as client:
                headers = {'X-WatsonX-API-Key': 'ibm-key', 'X-WatsonX-Project-ID': 'project'}
                response = await client.post('/research', json={'company': 'IBM'}, headers=headers)
                self.assertEqual(response.status_code, 200)
                await asyncio.sleep(0)
                self.assertEqual(process.call_args.args[-1], 'parallel')
                response = await client.post('/research', json={'company': 'IBM'}, headers={**headers, 'X-Tavily-API-Key': 'saved-key'})
                self.assertEqual(response.status_code, 200)
                await asyncio.sleep(0)
                self.assertEqual(process.call_args.args[-1], 'tavily')
                for provider in ('none', 'invalid', 'tavily'):
                    response = await client.post('/research', json={'company': 'IBM'}, headers={**headers, 'X-Search-Provider': provider})
                    self.assertEqual(response.status_code, 400)
                response = await client.post('/research', json={'company': 'IBM'})
                self.assertEqual(response.status_code, 400)
                with patch.dict(os.environ, {'SEARCH_PROVIDER': 'none'}):
                    response = await client.post('/research', json={'company': 'IBM'}, headers={**headers, 'X-Search-Provider': 'parallel'})
                    self.assertEqual(response.status_code, 400)
                with patch.dict(os.environ, {'TAVILY_API_KEY': 'server-key'}):
                    await client.post('/research', json={'company': 'IBM'}, headers=headers)
                    await asyncio.sleep(0)
                    self.assertEqual(process.call_args.args[-1], 'tavily')

    async def test_api_job_runs_normal_graph_with_no_search_key(self):
        import application
        completed = asyncio.Event()
        manager = AsyncMock()
        async def status(job_id, **kwargs):
            if kwargs.get('status') in ('completed', 'failed'):
                completed.set()
        manager.send_status_update.side_effect = status
        model = ScriptedModel()
        with patch.object(application, 'manager', manager), \
             patch.object(application, 'APIClient', return_value=object()), \
             patch('backend.nodes.researchers.base.ModelInference', return_value=model), \
             patch('backend.nodes.briefing.ModelInference', return_value=model), \
             patch('backend.nodes.editor.ModelInference', return_value=model):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application.app), base_url='http://test') as client:
                response = await client.post('/research', json={'company': 'IBM'}, headers={
                    'X-WatsonX-API-Key': 'scripted-key', 'X-WatsonX-Project-ID': 'project',
                })
                self.assertEqual(response.status_code, 200)
                job_id = response.json()['job_id']
                await asyncio.wait_for(completed.wait(), timeout=10)
        self.assertEqual(application.job_status[job_id]['status'], 'completed')
        self.assertIn('IBM builds business technology', application.job_status[job_id]['report'])
        self.assert_requests()

    async def test_resolver_preserves_credentials_and_overrides(self):
        self.assertIsInstance(create_search_client(), ParallelSearchClient)
        with patch('backend.services.search.AsyncTavilyClient') as tavily:
            self.assertIs(create_search_client('saved-key'), tavily.return_value)
            tavily.assert_called_once_with(api_key='saved-key')
            self.assertIsInstance(create_search_client('saved-key', 'parallel'), ParallelSearchClient)
        with patch.dict(os.environ, {'SEARCH_PROVIDER': 'tavily'}):
            with self.assertRaises(ValueError):
                create_search_client()
            self.assertIsInstance(create_search_client(provider='parallel'), ParallelSearchClient)
        for value in ('none', 'typo'):
            with patch.dict(os.environ, {'SEARCH_PROVIDER': value}):
                with self.assertRaises(ValueError):
                    resolve_search_provider('saved-key', 'parallel')

    async def test_tavily_options_and_score_filter_are_preserved(self):
        tavily = AsyncMock()
        tavily.search.return_value = {'results': [
            {'url': 'https://example.com/low', 'content': 'low', 'score': 0.2},
            {'url': 'https://example.com/high', 'content': 'high', 'score': 0.9},
        ]}
        with patch('backend.nodes.researchers.base.ModelInference'):
            researcher = FinancialAnalyst(tavily, object(), 'project')
        docs = await researcher.search_documents({}, ['IBM financial report overview'])
        tavily.search.assert_awaited_once_with('IBM financial report overview', search_depth='basic', include_raw_content=False, max_results=5, topic='finance')
        curated = await Curator().curate_data({'company': 'IBM', 'company_data': docs})
        self.assertEqual(list(curated['curated_company_data']), ['https://example.com/high'])
        self.assertEqual(curated['curated_company_data']['https://example.com/high']['content'], 'high')

    async def test_timeout_and_cancellation_close_transport(self):
        self.fixture.mode = 'wait'
        client = create_search_client()
        client.timeout = 0.1
        with patch('backend.nodes.researchers.base.ModelInference'):
            researcher = CompanyAnalyzer(client, object(), 'project')
        websocket = AsyncMock()
        state = {'websocket_manager': websocket, 'job_id': 'job'}
        self.assertEqual(await researcher.search_documents(state, ['IBM company services']), {})
        self.assertEqual(websocket.send_status_update.call_args.kwargs['status'], 'query_error')
        self.assertTrue(self.fixture.cancelled.is_set())
        self.fixture.cancelled.clear()
        self.fixture.started.clear()
        client.timeout = 60
        task = asyncio.create_task(researcher.search_documents(state, ['IBM company services']))
        await self.fixture.started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(self.fixture.cancelled.is_set())

    async def test_errors_reach_researcher_without_fallback(self):
        self.fixture.mode = 'error'
        with patch('backend.nodes.researchers.base.ModelInference'), \
             patch('backend.services.search.AsyncTavilyClient') as tavily:
            researcher = CompanyAnalyzer(create_search_client(), object(), 'project')
            websocket = AsyncMock()
            docs = await researcher.search_single_query('IBM company services', websocket, 'job')
            self.assertEqual(docs, {})
            self.assertEqual(websocket.send_status_update.call_args.kwargs['status'], 'query_error')
            tavily.assert_not_called()
        self.fixture.mode = 'malformed'
        with self.assertRaises(ValueError):
            await create_search_client().search('IBM company services')

    async def test_fetch_urls_and_ranked_results(self):
        client = create_search_client()
        for url in ('file:///etc/passwd', 'https://user:secret@example.com', 'https://'):
            with self.assertRaises(ValueError):
                await client.extract(url)
        self.assertEqual(self.fixture.requests, [])
        result = await client.search('IBM company services', max_results=1, topic='finance')
        self.assertEqual(len(result['results']), 1)
        self.assertIsNone(result['results'][0]['score'])
        await client.extract('https://example.com/ibm?source=company')
        calls = self.assert_requests()
        self.assertTrue(calls[0]['params']['arguments']['objective'].startswith('Find financial information'))
        self.assertEqual(calls[1]['params']['arguments']['urls'], ['https://example.com/ibm?source=company'])

    async def test_page_query_urls_survive_curation_fetch_and_citations(self):
        urls = ['https://example.com/report?id=1', 'https://example.com/report?id=2']
        docs = {url: {'url': url, 'title': url, 'content': 'IBM report', 'provider': 'parallel', 'score': None}
                for url in urls}
        state = await Curator().curate_data({'company': 'IBM', 'company_data': docs})
        self.assertEqual(list(state['curated_company_data']), urls)
        self.assertEqual(state['references'], urls)
        from backend.nodes.enricher import Enricher
        state = await Enricher(create_search_client()).enrich_data(state)
        self.assertTrue(all(doc.get('raw_content') for doc in state['curated_company_data'].values()))
        calls = self.assert_requests()
        self.assertEqual([call['params']['arguments']['urls'][0] for call in calls], urls)


if __name__ == '__main__':
    unittest.main()
