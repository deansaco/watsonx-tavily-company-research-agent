from langchain_core.messages import AIMessage
from langchain_openai import ChatOpenAI
import google.generativeai as genai
from typing import Dict, Any, Union, List
import os
import logging
from ..classes import ResearchState
import asyncio

logger = logging.getLogger(__name__)

class Briefing:
    """Creates briefings for each research category and updates the ResearchState."""
    
    def __init__(self) -> None:
        self.max_doc_length = 8000  # Maximum document content length
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        if not self.gemini_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        
        # Configure Gemini
        genai.configure(api_key=self.gemini_key)
        self.gemini_model = genai.GenerativeModel('gemini-2.0-flash')

    async def generate_category_briefing(
        self, docs: Union[Dict[str, Any], List[Dict[str, Any]]], 
        category: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        company = context.get('company', 'Unknown')
        industry = context.get('industry', 'Unknown')
        logger.info(f"Generating {category} briefing for {company} using {len(docs)} documents")

        # Send category start status
        if websocket_manager := context.get('websocket_manager'):
            if job_id := context.get('job_id'):
                await websocket_manager.send_status_update(
                    job_id=job_id,
                    status="briefing_start",
                    message=f"Generating {category} briefing",
                    result={
                        "step": "Briefing",
                        "category": category,
                        "total_docs": len(docs)
                    }
                )

        prompts = {
            'company': f"""Create a focused company briefing for {company}.
Key requirements:
1. Start with: "{company} is a [what] that [does what] for [whom]"
2. Structure using these exact headers and bullet points:

Core Product/Service
• List distinct products/features
• Include only verified technical capabilities

Target Market
• List specific target audiences
• List verified use cases
• List confirmed customers/partners

Key Differentiators
• List unique features
• List proven advantages

Business Model
• Discuss product / service pricing
• List distribution channels

3. Each bullet must be a single, complete fact
4. No paragraphs, only bullet points
5. No explanations or commentary.""",

            'industry': f"""Analyze {company}'s market position.
Key requirements:
1. Structure using these exact headers and bullet points:

Market Overview
• State {company}'s exact market segment
• List market size with year
• List growth rate with year range

Direct Competition
• List named direct competitors
• List specific competing products
• List market positions

Competitive Advantages
• List unique technical features
• List proven advantages

Market Challenges
• List specific verified challenges

2. Each bullet must be a single, complete news event.
3. No paragraphs, only bullet points
4. No explanations or commentary.""",

            'financial': f"""List {company}'s financial data.
Key requirements:
1. Structure using these headers and bullet points:

Funding & Investment
• Total funding amount with date
• List each funding round with date
• List named investors

Revenue Model
• Discuss product / service pricing if applicable

2. Include specific numbers when possible
3. No paragraphs, only bullet points
4. Never provide explanations or commentary.""",

            'news': f"""List verified {company} news.
Key requirements:
1. Structure into these categories:
   - Major Announcements
     • Product / service launches
     • New initiatives
   
   - Partnerships
     • Integrations
     • Collaborations
   
   - Recognition
     • Awards
     • Press coverage

2. Sort newest to oldest
3. One event per bullet point
4. Never provide explanations or commentary like "Here is the news..."."""
        }
        
        # Normalize docs to a list of (url, doc) tuples
        items = list(docs.items()) if isinstance(docs, dict) else [
            (doc.get('url', f'doc_{i}'), doc) for i, doc in enumerate(docs)
        ]
        # Sort documents by evaluation score (highest first)
        sorted_items = sorted(
            items, 
            key=lambda x: float(x[1].get('evaluation', {}).get('overall_score', '0')), 
            reverse=True
        )
        
        doc_texts = []
        total_length = 0
        for _ , doc in sorted_items:
            title = doc.get('title', '')
            content = doc.get('raw_content') or doc.get('content', '')
            if len(content) > self.max_doc_length:
                content = content[:self.max_doc_length] + "... [content truncated]"
            doc_entry = f"Title: {title}\n\nContent: {content}"
            if total_length + len(doc_entry) < 120000:  # Keep under limit
                doc_texts.append(doc_entry)
                total_length += len(doc_entry)
            else:
                break
        
        separator = "\n" + "-" * 40 + "\n"
        prompt = f"""{prompts.get(category, 'Create an informative and insightful research briefing on {company} in the {industry} industry based on the provided documents.')}

Analyze the following documents and extract key information:

{separator}{separator.join(doc_texts)}{separator}

Create a concise briefing with factual, verifiable information without introductions or conclusions. Never provide explanations or additional commentary. Never say "Okay here is..." or anything like that. Just provide the briefing."""
        
        try:
            logger.info("Sending prompt to LLM")
            response = self.gemini_model.generate_content(prompt)
            content = response.text.strip()
            if not content:
                logger.error(f"Empty response from LLM for {category} briefing")
                return {'content': ''}

            # Send completion status
            if websocket_manager := context.get('websocket_manager'):
                if job_id := context.get('job_id'):
                    await websocket_manager.send_status_update(
                        job_id=job_id,
                        status="briefing_complete",
                        message=f"Completed {category} briefing",
                        result={
                            "step": "Briefing",
                            "category": category
                        }
                    )

            return {'content': content}
        except Exception as e:
            logger.error(f"Error generating {category} briefing: {e}")
            return {'content': ''}

    async def create_briefings(self, state: ResearchState) -> ResearchState:
        company = state.get('company', 'Unknown Company')
        
        # Send initial briefing status
        if websocket_manager := state.get('websocket_manager'):
            if job_id := state.get('job_id'):
                await websocket_manager.send_status_update(
                    job_id=job_id,
                    status="processing",
                    message="Starting research briefings",
                    result={"step": "Briefing"}
                )

        context = {
            "company": company,
            "industry": state.get('industry', 'Unknown'),
            "hq_location": state.get('hq_location', 'Unknown'),
            "websocket_manager": state.get('websocket_manager'),  # Pass WebSocket manager
            "job_id": state.get('job_id')  # Pass job ID
        }
        logger.info(f"Creating section briefings for {company}")
        
        # Mapping of curated data fields to briefing categories
        categories = {
            'financial_data': ("financial", "financial_briefing"),
            'news_data': ("news", "news_briefing"),
            'industry_data': ("industry", "industry_briefing"),
            'company_data': ("company", "company_briefing")
        }
        
        # Initialize a dict for all briefings
        briefings = {}
        summary = [f"Creating section briefings for {company}:"]
        
        # Create tasks for parallel processing
        tasks = []
        for data_field, (cat, briefing_key) in categories.items():
            curated_key = f'curated_{data_field}'
            curated_data = state.get(curated_key, {})
            if curated_data:
                logger.info(f"Processing {data_field} with {len(curated_data)} documents")
                summary.append(f"Processing {data_field} ({len(curated_data)} documents)...")
                tasks.append((
                    self.generate_category_briefing(curated_data, cat, context),
                    cat,
                    briefing_key,
                    data_field
                ))
            else:
                summary.append(f"No data available for {data_field}")
                state[briefing_key] = ""

        # Process all briefings in parallel
        if tasks:
            results = await asyncio.gather(*(task[0] for task in tasks))
            
            # Process results
            for result, (_, cat, briefing_key, data_field) in zip(results, tasks):
                if result['content']:
                    briefings[cat] = result['content']
                    state[briefing_key] = result['content']
                    summary.append(f"Completed {data_field} ({len(result['content'])} characters)")
                else:
                    summary.append(f"Failed to generate briefing for {data_field}")
                    state[briefing_key] = ""
        
        state['briefings'] = briefings
        state.setdefault('messages', []).append(AIMessage(content="\n".join(summary)))
        return state

    async def run(self, state: ResearchState) -> ResearchState:
        return await self.create_briefings(state)