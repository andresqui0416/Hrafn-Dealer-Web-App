"""
FastAPI Microserver for Offer Scraping API
Runs on port 5000 and provides a single cron endpoint to run both scrapers
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Tuple
from datetime import datetime
import sys
import os
import logging

# Add the current directory to the path so we can import the scrapers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from offer_scrape.lincoln import LincolnScraper
from offer_scrape.landrover import LandRoverScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Offer Scraping API",
    description="Microserver API for running offer scrapers via cron job",
    version="1.0.0"
)


class ScrapeResponse(BaseModel):
    success: bool
    lincoln_success: bool
    landrover_success: bool
    lincoln_count: int
    landrover_count: int
    total_count: int
    duration_seconds: float
    message: str
    error: Optional[str] = None


def run_lincoln_scraper(api_url: str = None) -> Tuple[bool, int]:
    """
    Run the Lincoln scraper
    
    Args:
        api_url: Optional API endpoint URL
        
    Returns:
        Tuple of (success: bool, offer_count: int)
    """
    logger.info("Starting Lincoln Scraper")
    
    try:
        scraper = LincolnScraper(api_url=api_url)
        offers = scraper.scrape()
        
        if not offers:
            logger.info("No Lincoln offers found")
            return True, 0
        
        logger.info(f"Lincoln scraper found {len(offers)} offers")
        
        # Send to API
        success = scraper.send_to_api(offers)
        
        if success:
            logger.info(f"Successfully sent {len(offers)} Lincoln offers to API")
        else:
            logger.error("Failed to send Lincoln offers to API")
        
        return success, len(offers)
        
    except Exception as e:
        logger.error(f"Error running Lincoln scraper: {e}", exc_info=True)
        return False, 0


def run_landrover_scraper(api_url: str = None) -> Tuple[bool, int]:
    """
    Run the Land Rover scraper
    
    Args:
        api_url: Optional API endpoint URL
        
    Returns:
        Tuple of (success: bool, offer_count: int)
    """
    logger.info("Starting Land Rover Scraper")
    
    try:
        scraper = LandRoverScraper(api_url=api_url)
        offers = scraper.scrape_all(headless=True)
        
        if not offers:
            logger.info("No Land Rover offers found")
            return True, 0
        
        logger.info(f"Land Rover scraper found {len(offers)} offers")
        
        # Send to API
        success = scraper.send_to_api(offers)
        
        if success:
            logger.info(f"Successfully sent {len(offers)} Land Rover offers to API")
        else:
            logger.error("Failed to send Land Rover offers to API")
        
        return success, len(offers)
        
    except Exception as e:
        logger.error(f"Error running Land Rover scraper: {e}", exc_info=True)
        return False, 0


@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "status": "ok",
        "service": "Offer Scraping API",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/scrape", response_model=ScrapeResponse)
@app.get("/api/scrape", response_model=ScrapeResponse)
async def run_scrapers():
    """
    Run both Lincoln and Land Rover scrapers
    
    This endpoint can be called via cron job to trigger scraping.
    Supports both GET and POST methods for flexibility.
    """
    start_time = datetime.now()
    logger.info("Starting offer scraping cron job")
    
    # Get API URL from environment variable or use default
    api_url = os.getenv(
        "OFFERS_SCRAPER_API_URL",
        "http://localhost:3000/api/offers/scrape"
    )
    
    try:
        # Run Lincoln scraper
        lincoln_success, lincoln_count = run_lincoln_scraper(api_url=api_url)
        
        # Run Land Rover scraper (runs independently, even if Lincoln failed)
        landrover_success, landrover_count = run_landrover_scraper(api_url=api_url)
        
        # Calculate duration
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        total_count = lincoln_count + landrover_count
        overall_success = lincoln_success and landrover_success
        
        message = (
            f"Scraping completed: Lincoln ({lincoln_count} offers, "
            f"{'success' if lincoln_success else 'failed'}), "
            f"Land Rover ({landrover_count} offers, "
            f"{'success' if landrover_success else 'failed'}). "
            f"Total: {total_count} offers in {duration:.2f}s"
        )
        
        logger.info(message)
        
        return ScrapeResponse(
            success=overall_success,
            lincoln_success=lincoln_success,
            landrover_success=landrover_success,
            lincoln_count=lincoln_count,
            landrover_count=landrover_count,
            total_count=total_count,
            duration_seconds=duration,
            message=message
        )
    
    except Exception as e:
        logger.error(f"Error in scraping cron job: {e}", exc_info=True)
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        return ScrapeResponse(
            success=False,
            lincoln_success=False,
            landrover_success=False,
            lincoln_count=0,
            landrover_count=0,
            total_count=0,
            duration_seconds=duration,
            message=f"Scraping failed: {str(e)}",
            error=str(e)
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "message": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )
