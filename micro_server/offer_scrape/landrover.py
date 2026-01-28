"""
Land Rover Offers Scraper
Scrapes offer data from Land Rover website using ChromeDriver
"""

import json
import re
import time
import sys
import os
import html
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin, urlparse

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Error: selenium is not installed. Please install it with: pip install selenium")
    sys.exit(1)

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: requests or beautifulsoup4 is not installed. Please install with: pip install requests beautifulsoup4")
    sys.exit(1)


class LandRoverScraper:
    def __init__(self, api_url: str = None):
        """
        Initialize Land Rover scraper
        
        Args:
            api_url: API endpoint URL to send scraped data to
        """
        self.api_url = api_url or os.getenv(
            "OFFERS_SCRAPER_API_URL",
            "http://localhost:3000/api/offers/scrape"
        )
        self.driver = None
        self.offers = []
        self.brand = "Land Rover"
        self.base_url = "https://www.landroverusa.com"
        self.models_url = "https://www.landroverusa.com/current-offers/index.html"

    def setup_driver(self, headless: bool = True):
        """Setup Chrome driver with options"""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.maximize_window()
            return True
        except Exception as e:
            print(f"Error setting up Chrome driver: {e}")
            print("Make sure ChromeDriver is installed and in PATH")
            return False

    def clean_html_text(self, text: str) -> str:
        """Remove HTML tags, decode entities, and normalize text"""
        if not text:
            return ""
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Decode HTML entities (handles &nbsp;, &amp;, &#39;, etc.)
        text = html.unescape(text)
        
        # Normalize whitespace (replace multiple spaces/newlines/tabs with single space)
        text = re.sub(r'\s+', ' ', text)
        
        # Strip and remove leading space if present
        text = text.strip()
        if text and text.startswith(' '):
            text = text[1:]
        
        return text

    def parse_number(self, text: str) -> Optional[float]:
        """Parse number from string, removing commas, dollar signs, etc."""
        if not text:
            return None
        try:
            cleaned = re.sub(r'[,$%]', '', str(text)).strip()
            num = float(cleaned)
            return num if not (num != num) else None  # Check for NaN
        except:
            return None

    def extract_term_months(self, text: str) -> Optional[int]:
        """Extract term months from text (e.g., 'for 36 months', '36 MONTHS', 'PER MONTH FOR 36 MONTHS')"""
        if not text:
            return None
        # Try pattern "PER MONTH FOR X MONTHS" first (Land Rover format)
        match = re.search(r'per\s+month\s+for\s+(\d+)\s+months?', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        # Try pattern "for X months"
        match = re.search(r'for\s+(\d+)\s+months?', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        # Try pattern "X months" or "X MONTHS"
        match = re.search(r'(\d+)\s+months?', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        return None

    def extract_due_at_signing(self, text: str) -> Optional[float]:
        """Extract due at signing amount from text"""
        if not text:
            return None
        match = re.search(r'\$([\d,]+)\s+(?:cash\s+)?due\s+at\s+signing', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_down_payment(self, text: str) -> Optional[float]:
        """
        Extract down payment amount and treat it as cashback.
        Examples:
        - '<b>$7,121&nbsp;</b>Down payment'
        - '$7,121 down payment'
        Handles HTML entities and whitespace variations.
        Only matches when "down payment" directly follows the dollar amount.
        """
        if not text:
            return None
        # Strict pattern: amount directly followed by "down payment" (with only HTML/whitespace/commas)
        # Handles cases like:
        # - "$7,121&nbsp;Down payment"
        # - "$7,121 Down payment"
        # - "<b>$7,121</b>Down payment"
        match = re.search(r'\$([\d,]+)(?:</[^>]+>|&nbsp;|&[a-z]+;|[\s,])+down\s+payment', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        
        return None

    def extract_miles_per_year(self, text: str, term_months: Optional[int] = None) -> Optional[int]:
        """
        Extract miles per year from text.
        Examples:
        - "excess mileage over 30,000 miles" -> if term is 36 months, returns 10000 (30,000 / 3)
        - "X miles per year" -> returns X directly
        """
        if not text:
            return None
        
        # First, try to find explicit "X miles per year" pattern
        match = re.search(r'(\d{1,3}(?:,\d{3})*)\s+miles\s+per\s+year', text, re.IGNORECASE)
        if match:
            try:
                miles = int(match.group(1).replace(',', ''))
                if miles >= 0:
                    return miles
            except:
                pass
        
        # If we have term_months, look for total miles and calculate per year
        if term_months and term_months > 0:
            # Look for patterns like "over 30,000 miles" or "30,000 miles"
            match = re.search(r'(?:over|excess\s+mileage\s+over|up\s+to)\s+(\d{1,3}(?:,\d{3})*)\s+miles', text, re.IGNORECASE)
            if not match:
                # Try simpler pattern: just "X,XXX miles" in mileage context
                match = re.search(r'(\d{1,3}(?:,\d{3})*)\s+miles(?:\s+at|\s+over|$)', text, re.IGNORECASE)
            
            if match:
                try:
                    total_miles = int(match.group(1).replace(',', ''))
                    if total_miles > 0:
                        # Calculate miles per year: total_miles / (term_months / 12)
                        years = term_months / 12.0
                        miles_per_year = int(total_miles / years)
                        if miles_per_year >= 0:
                            return miles_per_year
                except:
                    pass
        
        return None

    def extract_offer_type_from_title(self, text: str) -> Optional[str]:
        """
        Extract offer type from title text like:
        - 'LEASE FOR' -> 'lease'
        - 'FINANCE FOR' or 'RETAIL OFFER' -> 'financing'
        - 'CASH OFFER' or similar -> 'cash'
        """
        if not text:
            return None
        t = text.strip().lower()
        if 'lease' in t:
            return 'lease'
        if 'finance' in t or 'retail offer' in t or 'retail' in t:
            return 'financing'
        if 'cash' in t or 'purchase' in t:
            return 'cash'
        return None

    def extract_year_from_text(self, text: str) -> Optional[int]:
        """Extract year from text (e.g., '2025 Range Rover')"""
        if not text:
            return None
        match = re.search(r'\b(20\d{2})\b', text)
        if match:
            try:
                year = int(match.group(1))
                if 2000 <= year <= 2100:
                    return year
            except:
                pass
        return None

    def extract_models_from_html(self, html_content: str) -> List[Dict[str, Any]]:
        """
        Extract model information from the HTML structure
        
        Args:
            html_content: HTML content from the models page
            
        Returns:
            List of dictionaries with model info: {name, year, url, model_code}
        """
        models = []
        
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find the main container with class "cmp-contentCardsInner swiper-wrapper"
            container = soup.find('div', class_='cmp-contentCardsInner')
            
            if not container:
                # Try alternative: find by swiper-wrapper class
                container = soup.find('div', class_=re.compile(r'swiper-wrapper'))
            
            if not container:
                print("Error: Could not find the main container (cmp-contentCardsInner or swiper-wrapper)")
                return models
            
            # Find all model cards (div.contentblock.el.gridEl.swiper-slide)
            model_cards = container.find_all('div', class_='contentblock')
            
            # Alternative: try finding by swiper-slide class
            if not model_cards:
                model_cards = container.find_all('div', class_=re.compile(r'swiper-slide'))
            
            print(f"Found {len(model_cards)} model cards in container")
            
            for card in model_cards:
                try:
                    # Extract model name from h2.headline.headline--s.cmp-ContentCard__heading > p
                    heading = card.find('h2', class_='headline')
                    model_name = None
                    if heading:
                        p_tag = heading.find('p')
                        if p_tag:
                            model_name = self.clean_html_text(p_tag.get_text())
                        else:
                            # Fallback: get text directly from heading
                            model_name = self.clean_html_text(heading.get_text())
                    
                    # Extract URL from a.secondary-link
                    link = card.find('a', class_='secondary-link')
                    url_path = None
                    if link and link.get('href'):
                        url_path = link.get('href')
                    
                    # If no link found, try data-href from imageLink span
                    if not url_path:
                        image_link = card.find('span', class_='imageLink')
                        if image_link and image_link.get('data-href'):
                            url_path = image_link.get('data-href')
                    
                    # Extract model code from URL if available
                    # Note: Year is not in the model list URLs, it will be extracted from individual offer pages
                    year = None
                    model_code = None
                    if url_path:
                        # Extract model code from URL (e.g., "range-rover" from /current-offers/range-rover-offers.html)
                        model_code_match = re.search(r'/([^/]+)-offers\.html', url_path)
                        if model_code_match:
                            model_code = model_code_match.group(1)
                        
                        # Make URL absolute if it's relative
                        if url_path.startswith('/'):
                            url_path = urljoin(self.base_url, url_path)
                        elif not url_path.startswith('http'):
                            # Handle relative URLs without leading slash
                            url_path = urljoin(self.base_url + '/', url_path)
                    
                    # Only add if we have at least model name and URL
                    if model_name and url_path:
                        model_info = {
                            'name': model_name,
                            'year': year,
                            'url': url_path,
                            'model_code': model_code,
                            'url_path': url_path
                        }
                        models.append(model_info)
                        print(f"  - {model_name} ({year or 'N/A'}) - {url_path}")
                    else:
                        print(f"  - Skipping card (missing name or URL: name={model_name}, url={url_path})")
                        
                except Exception as e:
                    print(f"  - Error extracting model from card: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
                    
        except Exception as e:
            print(f"Error parsing HTML: {e}")
            import traceback
            traceback.print_exc()
        
        return models

    def fetch_models(self) -> List[Dict[str, Any]]:
        """
        Fetch models from the Land Rover offers page
        
        Returns:
            List of model dictionaries
        """
        if not self.driver:
            print("Error: Driver not initialized. Call setup_driver() first.")
            return []
        
        try:
            print(f"\nFetching models from {self.models_url}")
            self.driver.get(self.models_url)
            
            # Wait for the model cards to load
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "contentblock"))
                )
            except TimeoutException:
                # Try alternative selector
                try:
                    WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CLASS_NAME, "swiper-slide"))
                    )
                except TimeoutException:
                    print("Warning: Model cards not found, proceeding anyway...")
            
            # Give it a moment for any dynamic content to load
            time.sleep(2)
            
            # Get page source and extract models
            html_content = self.driver.page_source
            models = self.extract_models_from_html(html_content)
            
            print(f"\nFound {len(models)} models")
            return models
            
        except Exception as e:
            print(f"Error fetching models: {e}")
            import traceback
            traceback.print_exc()
            return []

    def scrape_offers_for_model(self, model: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Scrape offers for a specific model
        
        Args:
            model: Dictionary with model information (name, url, etc.)
            
        Returns:
            List of offer dictionaries
        """
        offers = []
        
        if not self.driver:
            if not self.setup_driver():
                print(f"Failed to setup driver for {model.get('name')}")
                return offers
        
        try:
            url = model['url']
            print(f"  Scraping offers for {model.get('name')} from {url}")
            
            # Navigate to the model URL
            self.driver.get(url)
            time.sleep(3)  # Wait for page to load
            
            # Wait for offers container to load
            try:
                WebDriverWait(self.driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-component='offers']"))
                )
            except TimeoutException:
                print(f"    Timeout waiting for offers to load for {model.get('name')}")
                return offers
            
            # Get page source and parse with BeautifulSoup
            html_content = self.driver.page_source
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find all offer containers
            # Look for div with classes "odffers light aem-GridColumn aem-GridColumn--efault--12"
            # Note: "odffers" appears to be a typo in the HTML
            offer_containers = soup.find_all('div', class_=re.compile(r'odffers|offers'))
            
            # Also try finding by data-component="offers"
            if not offer_containers:
                offer_containers = soup.find_all('div', {'data-component': 'offers'})
            
            print(f"    Found {len(offer_containers)} offer containers")
            
            for container in offer_containers:
                try:
                    # Find the offers container inside
                    offers_div = container.find('div', {'data-component': 'offers'})
                    if not offers_div:
                        continue
                    
                    # Extract model name and year from h1.title > p
                    title_elem = offers_div.find('h1', class_='title')
                    model_name_full = None
                    year = None
                    trim = None
                    
                    if title_elem:
                        # Try to get text from p tag first
                        p_tag = title_elem.find('p')
                        if p_tag:
                            model_name_full = self.clean_html_text(p_tag.get_text())
                        else:
                            # Fallback: get text directly from h1
                            model_name_full = self.clean_html_text(title_elem.get_text())
                        
                        if model_name_full:
                            # Extract year from title (e.g., "2025 Range Rover P400 SE SWB")
                            year = self.extract_year_from_text(model_name_full)
                            
                            if year:
                                print(f"      Extracted year {year} from title: {model_name_full}")
                            
                            # Extract trim/model variant (everything after the base model name)
                            # Remove year if present to get model name + trim
                            model_name_clean = re.sub(r'^\d{4}\s+', '', model_name_full).strip()
                            trim = model_name_clean
                    
                    # Extract price (optional)
                    price_elem = offers_div.find('div', class_='offerPrice')
                    price = None
                    if price_elem:
                        p_tag = price_elem.find('p')
                        if p_tag:
                            price_text = self.clean_html_text(p_tag.get_text())
                            # Extract price number
                            price_match = re.search(r'\$([\d,]+)', price_text)
                            if price_match:
                                price = self.parse_number(price_match.group(1))
                    
                    # Extract offer info:
                    # Land Rover uses a single container (offerInfoLease) whose title
                    # distinguishes lease vs financing. We parse it generically and
                    # let offerType (from the title) decide whether the amount is APR
                    # or monthly payment.
                    offer_info_div = offers_div.find('div', class_='offerInfoLease')
                    if offer_info_div:
                        offer = self._extract_main_offer(offer_info_div, model, year, trim)
                        if offer:
                            offers.append(offer)
                    
                    # Cash-specific container (offerInfoCash) is not present in current markup,
                    # so we skip separate cash parsing here.
                
                except Exception as e:
                    print(f"    Error extracting offer from container: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            print(f"    Extracted {len(offers)} offers for {model.get('name')}")
            
        except Exception as e:
            print(f"  Error scraping offers for {model.get('name')}: {e}")
            import traceback
            traceback.print_exc()
        
        return offers

    def _extract_main_offer(self, offer_div, model: Dict, year: Optional[int], trim: Optional[str]) -> Optional[Dict[str, Any]]:
        """Extract primary offer data (lease or financing) from main offer div"""
        try:
            # Determine offer type from title if available
            offer_type = 'lease'
            title_div = offer_div.find('div', class_='Offers__info-title')
            if title_div:
                title_text = self.clean_html_text(title_div.get_text())
                detected_type = self.extract_offer_type_from_title(title_text)
                if detected_type:
                    offer_type = detected_type
            
            # Extract amount from p.Offers__amount > span.amount
            monthly_payment = None
            apr = None
            amount_elem = offer_div.find('p', class_='Offers__amount')
            if amount_elem:
                amount_span = amount_elem.find('span', class_='amount')
            
            # Extract term, due at signing, and down payment from Offers__info-body-copy
            term_months = None
            due_at_signing = None
            cash_back = None
            info_body = offer_div.find('div', class_='Offers__info-body-copy')
            if info_body:
                body_text = self.clean_html_text(info_body.get_text())
                term_months = self.extract_term_months(body_text)
                due_at_signing = self.extract_due_at_signing(body_text)
                # Down payment should be treated as cashback, independent of offer type
                # Check cleaned text first
                cash_back = self.extract_down_payment(body_text)
                # If not found, check raw HTML (handles HTML entities like &nbsp;)
                if not cash_back:
                    body_html = str(info_body)
                    cash_back = self.extract_down_payment(body_html)
            
            # Also check the entire offer_div HTML if not found yet
            if not cash_back:
                offer_html = str(offer_div)
                cash_back = self.extract_down_payment(offer_html)
            
            # Extract fine print from termsConditions
            fine_print = None
            miles_per_year = None
            terms_div = offer_div.find('div', class_='termsConditions')
            if terms_div:
                fine_print = self.clean_html_text(terms_div.get_text())
                # Extract miles per year from fine print (where mileage info is typically found)
                miles_per_year = self.extract_miles_per_year(fine_print, term_months)
                # Also check fine print for down payment (description text often appears here)
                if not cash_back:
                    cash_back = self.extract_down_payment(fine_print)
                # If still not found, check raw HTML of termsConditions
                if not cash_back:
                    terms_html = str(terms_div)
                    cash_back = self.extract_down_payment(terms_html)
            
            # Extract expiration date from fine print if available
            expiration_date = None
            if fine_print:
                # Look for date patterns in fine print
                date_match = re.search(r'by\s+(\d{1,2}/\d{1,2}/\d{4})', fine_print, re.IGNORECASE)
                if date_match:
                    try:
                        expiration_date = datetime.strptime(date_match.group(1), "%m/%d/%Y")
                        expiration_date = expiration_date.replace(tzinfo=timezone.utc)
                    except:
                        pass
            
            # Decide how to interpret amount based on offer type
            if amount_elem and amount_span:
                amount_value = self.parse_number(amount_span.get_text())
                if amount_value is not None:
                    if offer_type == 'financing':
                        # Treat as APR percentage (e.g., 4.49 -> 0.0449)
                        apr = amount_value / 100
                    elif offer_type == 'lease':
                        # Treat as monthly payment
                        monthly_payment = amount_value

            # Only create offer if we have meaningful pricing info
            if monthly_payment or apr:
                offer = {
                    'brand': self.brand,
                    'model': model.get('name', ''),
                    'year': year,
                    'trim': trim,
                    'offerType': offer_type,
                    'leaseMonthlyPayment': monthly_payment if offer_type == 'lease' else None,
                    'aprRate': apr if offer_type == 'financing' else None,
                    'aprTermMonths': term_months if offer_type == 'financing' else None,
                    'leaseTermMonths': term_months if offer_type == 'lease' else None,
                    'leaseDueAtSigning': due_at_signing,
                    'cashValue': cash_back,
                    'milesPerYear': miles_per_year,
                    'expirationDate': expiration_date.isoformat() if expiration_date else None,
                    'finePrint': fine_print,
                }
                return offer
            
        except Exception as e:
            print(f"      Error extracting lease offer: {e}")
        
        return None

    def scrape_all(self, headless: bool = True) -> List[Dict[str, Any]]:
        """
        Scrape all offers from Land Rover website
        
        Args:
            headless: Whether to run browser in headless mode
            
        Returns:
            List of all scraped offers
        """
        if not self.setup_driver(headless):
            return []
        
        try:
            # Fetch models
            models = self.fetch_models()
            
            if not models:
                print("No models found. Exiting.")
                return []
            
            # Scrape offers for each model
            all_offers = []
            for model in models:
                offers = self.scrape_offers_for_model(model)
                all_offers.extend(offers)
                time.sleep(1)  # Be polite with requests
            
            return all_offers
            
        finally:
            if self.driver:
                self.driver.quit()

    def send_to_api(self, offers: List[Dict[str, Any]]) -> bool:
        """
        Send scraped offers to API endpoint
        
        Args:
            offers: List of offer dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        if not offers:
            print("No offers to send")
            return False
        
        try:
            payload = {
                "brand": "Land Rover",
                "source": "landroverusa",
                "offers": offers,
            }
            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            print(f"Successfully sent {len(offers)} offers to API")
            return True
        except Exception as e:
            print(f"Error sending offers to API: {e}")
            return False


def main():
    """Main entry point for the scraper"""
    scraper = LandRoverScraper()
    offers = scraper.scrape_all(headless=True)
    
    if offers:
        print(f"\nScraped {len(offers)} offers total")
        scraper.send_to_api(offers)
    else:
        print("No offers scraped")


if __name__ == "__main__":
    main()
