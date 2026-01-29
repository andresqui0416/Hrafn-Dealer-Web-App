"""
Lincoln Offers Scraper
Scrapes offer data from Lincoln website using ChromeDriver
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


class LincolnScraper:
    def __init__(self, api_url: str = None):
        """
        Initialize Lincoln scraper
        
        Args:
            api_url: API endpoint URL to send scraped data to
        """
        self.api_url = api_url or os.getenv(
            "OFFERS_SCRAPER_API_URL",
            "http://localhost:3000/api/offers/scrape"
        )
        self.driver = None
        self.offers = []
        self.brand = "Lincoln"
        self.base_url = "https://www.lincoln.com"
        self.models_url = "https://www.lincoln.com/new-deals-and-offers/?gnav=header-shop-newdeals"

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

    def extract_monthly_payment(self, text: str) -> Optional[float]:
        """Extract monthly payment from text (e.g., '$1,237 / mo')"""
        if not text:
            return None
        # Look for patterns like "$1,237 / mo" or "$1,237/mo"
        match = re.search(r'\$([\d,]+)\s*/?\s*mo', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_term_months(self, text: str) -> Optional[int]:
        """Extract term months from text (e.g., 'for 39 months', 'for 84 months', 'for 36 mos.', '72 mos.')"""
        if not text:
            return None
        # First try pattern with "for" keyword
        match = re.search(r'for\s+(\d+)\s+mo(?:nths?|s\.?)', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        # Also try pattern without "for" - just number followed by "mos." or "months"
        match = re.search(r'(\d+)\s+mo(?:nths?|s\.?)', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        return None

    def extract_due_at_signing(self, text: str) -> Optional[float]:
        """Extract due at signing amount from text"""
        if not text:
            return None
        # Handle formats like "$0 Cash Due at Signing" or "$9,995 due at signing"
        match = re.search(r'\$([\d,]+)\s+(?:cash\s+)?due\s+at\s+signing', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_apr(self, text: str) -> Optional[float]:
        """Extract APR from text (e.g., '6.9%', '0%', '0 %')"""
        if not text:
            return None
        # Look for percentage patterns - handle cases where number and % might be separated
        # Pattern: number (with optional decimal) followed by optional whitespace and %
        match = re.search(r'(\d+\.?\d*)\s*%', text)
        if match:
            try:
                apr = float(match.group(1))
                # Accept 0% as valid APR
                if 0 <= apr <= 100:
                    return apr / 100  # Convert to decimal (0% -> 0.0)
            except:
                pass
        # Also try to find "APR" keyword and extract the percentage before it
        # Pattern: "0% APR" or "0 % APR" or "0 APR"
        apr_match = re.search(r'(\d+\.?\d*)\s*%?\s+APR', text, re.IGNORECASE)
        if apr_match:
            try:
                apr = float(apr_match.group(1))
                if 0 <= apr <= 100:
                    return apr / 100
            except:
                pass
        return None

    def extract_down_payment(self, text: str) -> Optional[float]:
        """Extract down payment from text (e.g., 'Based on $10,259 down payment')"""
        if not text:
            return None
        match = re.search(r'\$([\d,]+)\s+down\s+payment', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_miles_per_year(self, text: str, term_months: Optional[int] = None) -> Optional[int]:
        """
        Extract miles per year from text.
        Examples:
        - "mileage over 31,500 miles" -> if term is 36 months, returns 10500 (31,500 / 3)
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
            # Look for patterns like "over 31,500 miles" or "31,500 miles"
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

    def extract_cashback_from_disclaimer(self, text: str) -> Optional[float]:
        """
        Extract cashback (Bonus Cash) from disclaimer text.
        Example: "Cash due at signing is after $1,000 Bonus Cash (PGM #11083)"
        """
        if not text:
            return None
        # Look for patterns like "$1,000 Bonus Cash" or "after $1,000 Bonus Cash"
        match = re.search(r'\$([\d,]+)\s+bonus\s+cash', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_expiration_date_from_text(self, text: str) -> Optional[datetime]:
        """
        Extract expiration date from disclaimer text.
        Examples: "by 3/31/26", "by 3/31/2026", "Take delivery by 3/31/26"
        """
        if not text:
            return None
        
        # Look for patterns like "by 3/31/26" or "by 3/31/2026"
        date_patterns = [
            r'by\s+(\d{1,2}/\d{1,2}/\d{2,4})',  # "by 3/31/26" or "by 3/31/2026"
            r'(\d{1,2}/\d{1,2}/\d{2,4})',         # Just the date "3/31/26"
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_text = match.group(1).strip()
                # Try to parse the date
                try:
                    # Handle 2-digit year
                    if len(date_text.split('/')[-1]) == 2:
                        # Convert to 4-digit year (assume 2000s)
                        parts = date_text.split('/')
                        year = int(parts[2])
                        if year < 50:  # Assume 20xx for years < 50
                            year += 2000
                        else:  # Assume 19xx for years >= 50
                            year += 1900
                        date_text = f"{parts[0]}/{parts[1]}/{year}"
                    
                    parsed_date = self._parse_date_string(date_text)
                    if parsed_date:
                        return parsed_date
                except:
                    continue
        
        return None
    
    def _parse_date_string(self, date_text: str) -> Optional[datetime]:
        """
        Parse a date string into a datetime object
        
        Args:
            date_text: Date string in various formats
            
        Returns:
            datetime object or None if parsing fails
        """
        if not date_text:
            return None
        
        date_text = date_text.strip()  
        
        # Try common date formats
        # Note: %d handles both "9" and "09" formats
        date_formats = [
            "%B %d, %Y",      # January 9, 2026 or January 09, 2026
            "%b %d, %Y",      # Jan 9, 2026 or Jan 09, 2026
            "%B %d %Y",       # January 9 2026 (no comma)
            "%b %d %Y",       # Jan 9 2026 (no comma)
            "%m/%d/%Y",       # 01/09/2026
            "%m/%d/%y",       # 01/09/26 (2-digit year)
            "%Y-%m-%d",       # 2026-01-09
            "%d/%m/%Y",       # 09/01/2026 (European format)
        ]
        
        for date_format in date_formats:
            try:
                parsed_date = datetime.strptime(date_text, date_format)
                return parsed_date.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        
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
            
            # First find the main parent div with data-fd-target-component="flexColumnFeature" or class "fcf-outer-wrapper"
            # This is the main container that holds all the model tiles
            parent_div = soup.find('div', {'data-fd-target-component': 'flexColumnFeature'})
            
            if not parent_div:
                # Fallback: try to find by class
                parent_div = soup.find('div', class_='fcf-outer-wrapper')
            
            if not parent_div:
                print("Error: Could not find the main parent div (flexColumnFeature/fcf-outer-wrapper)")
                return models
            
            # Now find the ul container within the parent div
            container = parent_div.find('ul', class_='fcf-container')
            
            if not container:
                print("Error: Could not find the model container (ul.fcf-container) within parent div")
                return models
            
            # Now find all model tiles (li elements with class "flexTile section") within the container
            model_tiles = container.find_all('li', class_='flexTile section')
            
            print(f"Found {len(model_tiles)} model tiles in container")
            
            for tile in model_tiles:
                try:
                    # Extract model name from h3.headline -> div -> strong
                    headline = tile.find('h3', class_='headline')
                    model_name = None
                    if headline:
                        strong_tag = headline.find('strong')
                        if strong_tag:
                            model_name = self.clean_html_text(strong_tag.get_text())
                            # Remove ® symbol if present
                            model_name = model_name.replace('®', '').strip()
                    
                    # Extract URL from the link
                    link = tile.find('a', href=True)
                    url_path = None
                    if link:
                        url_path = link.get('href')
                    
                    # Extract year from URL (e.g., /luxury-suvs/navigator/2025/pricing-and-incentives/)
                    year = None
                    model_code = None
                    if url_path:
                        # Extract year from URL pattern: /luxury-suvs/{model}/{year}/pricing-and-incentives/
                        year_match = re.search(r'/(\d{4})/', url_path)
                        if year_match:
                            try:
                                year = int(year_match.group(1))
                            except:
                                pass
                        
                        # Extract model code from URL (e.g., "navigator" from /luxury-suvs/navigator/2025/...)
                        model_code_match = re.search(r'/luxury-suvs/([^/]+)/', url_path)
                        if model_code_match:
                            model_code = model_code_match.group(1)
                        
                        # Make URL absolute if it's relative
                        if url_path.startswith('/'):
                            url_path = urljoin(self.base_url, url_path)
                    
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
                        print(f"  - Skipping tile (missing name or URL)")
                        
                except Exception as e:
                    print(f"  - Error extracting model from tile: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error parsing HTML: {e}")
            import traceback
            traceback.print_exc()
        
        return models

    def fetch_models(self) -> List[Dict[str, Any]]:
        """
        Fetch models from the Lincoln deals page
        
        Returns:
            List of model dictionaries with name, year, url, model_code
        """
        models = []
        
        if not self.setup_driver():
            print("Failed to setup driver, cannot fetch models")
            return models
        
        try:
            print(f"Fetching models from: {self.models_url}")
            self.driver.get(self.models_url)
            
            # Wait for the page to load
            time.sleep(3)
            
            # Wait for model tiles to appear
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "li.flexTile.section"))
                )
            except TimeoutException:
                print("Timeout waiting for model tiles to load")
                return models
            
            # Get page source and extract models
            html_content = self.driver.page_source
            models = self.extract_models_from_html(html_content)
            
            print(f"\nExtracted {len(models)} models")
            
        except Exception as e:
            print(f"Error fetching models: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if self.driver:
                self.driver.quit()
                self.driver = None
        
        return models

    def scrape_offers_for_model(self, model_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Scrape offers for a specific model
        
        Args:
            model_info: Dictionary with model name, year, url, model_code
            
        Returns:
            List of offer dictionaries
        """
        offers = []
        
        if not self.driver:
            if not self.setup_driver():
                print(f"Failed to setup driver for {model_info['name']}")
                return offers
        
        try:
            url = model_info['url']
            print(f"  Scraping offers for {model_info['name']} from {url}")
            
            # Extract model name (use model_code if available, otherwise extract from name)
            model_name = model_info.get('model_code', '')
            if not model_name:
                # Extract model name from full name (e.g., "Navigator" from "Lincoln Navigator")
                full_name = model_info.get('name', '')
                if 'Lincoln' in full_name:
                    model_name = full_name.replace('Lincoln', '').strip()
                else:
                    model_name = full_name
            
            # Capitalize first letter of each word for model name (e.g., "Navigator")
            model_name = model_name.title()
            
            # Extract year from URL (e.g., /luxury-suvs/navigator/2025/pricing-and-incentives/)
            year = 2025  # Default fallback
            year_match = re.search(r'/(\d{4})/', url)
            if year_match:
                try:
                    year = int(year_match.group(1))
                except:
                    pass
            
            # Default zip code
            zip_code = "95556"
            
            # Navigate to base domain first to set cookie
            self.driver.get(self.base_url)
            time.sleep(1)
            
            # Set FPI cookie
            cookie_value = f"make=Lincoln&html=false&model={model_name}&year={year}&zip={zip_code}"
            self.driver.add_cookie({
                'name': 'FPI',
                'value': cookie_value,
                'domain': '.lincoln.com'
            })
            
            # Now navigate to the model URL
            self.driver.get(url)
            time.sleep(3)  # Wait for page to load
            
            # Wait for offers section to load
            try:
                WebDriverWait(self.driver, 15).until(
                    EC.any_of(
                        EC.presence_of_element_located((By.ID, "featured-lease-offers-lines-container")),
                        EC.presence_of_element_located((By.ID, "featured-retail-offer-lines-container"))
                    )
                )
            except TimeoutException:
                print(f"    Timeout waiting for offers to load for {model_info['name']}")
                return offers
            
            # Get page source and parse with BeautifulSoup
            html_content = self.driver.page_source
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract lease offers from featured-lease-offers-lines-container
            lease_container = soup.find('div', id='featured-lease-offers-lines-container')
            if lease_container:
                lease_offers = self._extract_offers_from_container(lease_container, model_info, 'lease', url)
                offers.extend(lease_offers)
            
            # Extract financing offers from featured-retail-offer-lines-container
            retail_container = soup.find('div', id='featured-retail-offer-lines-container')
            if retail_container:
                retail_offers = self._extract_offers_from_container(retail_container, model_info, 'financing', url)
                offers.extend(retail_offers)
            
            print(f"    Extracted {len(offers)} offers for {model_info['name']}")
            
        except Exception as e:
            print(f"  Error scraping offers for {model_info['name']}: {e}")
            import traceback
            traceback.print_exc()
        
        return offers

    def _extract_offers_from_container(self, container, model_info: Dict, offer_type: str, source_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extract offers from a container (lease or retail)
        
        Args:
            container: BeautifulSoup element containing offers
            model_info: Dictionary with model information
            offer_type: 'lease' or 'financing'
            source_url: Page URL where offers were scraped
            
        Returns:
            List of offer dictionaries
        """
        offers = []
        
        try:
            # Find all offer cards with class "io-large-card ng-scope"
            # These are the actual offer cards that contain offer data
            all_cards = container.find_all('div', recursive=True)
            offer_cards = []
            
            for card in all_cards:
                # Check if card has both classes: "io-large-card" and "ng-scope"
                card_classes = card.get('class', [])
                if 'io-large-card' in card_classes and 'ng-scope' in card_classes:
                    # Verify it has the expected structure (nameplate or detail div)
                    has_nameplate = card.find('div', class_='io-nameplate') is not None
                    has_detail = card.find('div', {'ng-bind-html': True}) is not None
                    if not has_detail:
                        # Also check for text-center with ng-binding class
                        for div in card.find_all('div', class_='text-center'):
                            if 'ng-binding' in div.get('class', []):
                                has_detail = True
                                break
                    
                    if has_nameplate or has_detail:
                        offer_cards.append(card)
            
            print(f"    Found {len(offer_cards)} {offer_type} offer cards with class 'io-large-card ng-scope'")
            
            for idx, card in enumerate(offer_cards, 1):
                try:
                    print(f"      Processing {offer_type} offer card {idx}/{len(offer_cards)}")
                    
                    # Extract model name and trim from io-nameplate
                    nameplate = card.find('div', class_='io-nameplate')
                    trim = None
                    if nameplate:
                        nameplate_text = nameplate.get_text()
                        # Extract trim from nameplate (e.g., "2025 Lincoln Corsair Premiere" -> "Premiere")
                        # The structure is: <div>2025 Lincoln Corsair</div><div>Premiere</div>
                        divs = nameplate.find_all('div')
                        if len(divs) >= 2:
                            # Second div is usually the trim
                            trim = self.clean_html_text(divs[1].get_text())
                    
                    # Extract offer details from the detail div
                    # Look for div with ng-bind-html attribute or class containing ng-binding
                    detail_div = card.find('div', {'ng-bind-html': True})
                    if not detail_div:
                        # Try finding by class
                        detail_div = card.find('div', class_=re.compile(r'ng-binding'))
                        if detail_div and 'text-center' not in detail_div.get('class', []):
                            # Make sure it's the right one
                            detail_div = None
                        if not detail_div:
                            # Try text-center with ng-binding
                            for div in card.find_all('div', class_='text-center'):
                                if 'ng-binding' in div.get('class', []):
                                    detail_div = div
                                    break
                    
                    if not detail_div:
                        continue
                    
                    detail_html = str(detail_div)
                    detail_text = self.clean_html_text(detail_div.get_text())
                    print(f"        Detail text: {detail_text[:100]}...")  # Debug: show first 100 chars
                    
                    # Extract disclaimer
                    disclaimer_div = card.find('div', class_='io-disclaimer')
                    disclaimer_text = None
                    if disclaimer_div:
                        disclaimer_text = self.clean_html_text(disclaimer_div.get_text())
                        print(f"        Found disclaimer text: {len(disclaimer_text)} chars")
                    else:
                        print(f"        No disclaimer found")
                    
                    # Extract expiration date from disclaimer
                    expiration_date = None
                    if disclaimer_text:
                        expiration_date = self.extract_expiration_date_from_text(disclaimer_text)
                    
                    # Extract offer data based on type
                    if offer_type == 'lease':
                        offer = self._extract_lease_offer_from_card(detail_html, detail_text, disclaimer_text, model_info, trim, expiration_date, source_url)
                    else:  # financing
                        offer = self._extract_finance_offer_from_card(detail_html, detail_text, disclaimer_text, model_info, trim, expiration_date, source_url)
                    
                    if offer:
                        offers.append(offer)
                        print(f"        ✓ Extracted {offer_type} offer: {offer.get('trim', 'N/A')} - {offer.get('monthlyPayment') or offer.get('apr')}")
                    else:
                        print(f"        ✗ Failed to extract offer data from card {idx}")
                
                except Exception as e:
                    print(f"      Error extracting offer from card: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
        except Exception as e:
            print(f"    Error extracting offers from container: {e}")
            import traceback
            traceback.print_exc()
        
        return offers

    def _extract_lease_offer_from_card(self, detail_html: str, detail_text: str, disclaimer_text: Optional[str], model_info: Dict, trim: Optional[str], expiration_date: Optional[datetime], source_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Extract lease offer data from card detail HTML and text"""
        try:
            # Extract monthly payment (e.g., "$499/mo. for 36 mos.")
            monthly_payment = self.extract_monthly_payment(detail_text)
            
            # Extract term months
            term_months = self.extract_term_months(detail_text)
            
            # Extract due at signing (e.g., "$0 Cash Due at Signing")
            due_at_signing = self.extract_due_at_signing(detail_text)
            
            # Extract miles per year from disclaimer
            miles_per_year = None
            if disclaimer_text and term_months:
                miles_per_year = self.extract_miles_per_year(disclaimer_text, term_months)
            
            # Extract cashback from disclaimer (e.g., "Cash due at signing is after $1,000 Bonus Cash")
            cash_back = None
            if disclaimer_text:
                cash_back = self.extract_cashback_from_disclaimer(disclaimer_text)
            
            if monthly_payment or due_at_signing:
                return {
                    'brand': self.brand,
                    'year': model_info.get('year'),
                    'make': 'Lincoln',
                    'model': model_info.get('name'),
                    'trim': trim,
                    'offerType': 'lease',
                    'leaseMonthlyPayment': monthly_payment,
                    'leaseDueAtSigning': due_at_signing,
                    'leaseTermMonths': term_months,
                    'milesPerYear': miles_per_year,
                    'cashValue': cash_back,
                    'expirationDate': expiration_date.isoformat() if expiration_date else None,
                    'terms': disclaimer_text,
                    'finePrint': disclaimer_text,
                    'source_url': source_url,
                }
        except Exception as e:
            print(f"      Error extracting lease offer: {e}")
        return None

    def _extract_finance_offer_from_card(self, detail_html: str, detail_text: str, disclaimer_text: Optional[str], model_info: Dict, trim: Optional[str], expiration_date: Optional[datetime], source_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Extract finance offer data from card detail HTML and text"""
        try:
            # Extract APR (e.g., "2.9% APR for 60 mos." or "0% APR for 72 mos.")
            apr = self.extract_apr(detail_text)
            print(f"          Extracted APR: {apr}")
            
            # Extract term months
            term_months = self.extract_term_months(detail_text)
            print(f"          Extracted term months: {term_months}")
            
            # Extract cashback from detail or disclaimer
            cash_back = None
            # Look for "Bonus Cash" in detail text (e.g., "$1,000 Bonus Cash")
            bonus_cash_match = re.search(r'\$([\d,]+)\s+bonus\s+cash', detail_text, re.IGNORECASE)
            if bonus_cash_match:
                cash_back = self.parse_number(bonus_cash_match.group(1))
            else:
                # Try disclaimer
                if disclaimer_text:
                    cash_back = self.extract_cashback_from_disclaimer(disclaimer_text)
            print(f"          Extracted cashback: {cash_back}")
            
            # Check if we have valid offer data (apr can be 0.0, so check for not None)
            # For financing offers, only check APR, not monthly payment
            print(f"          Checking offer validity: apr={apr} (is not None: {apr is not None})")
            if apr is not None:
                return {
                    'brand': self.brand,
                    'year': model_info.get('year'),
                    'make': 'Lincoln',
                    'model': model_info.get('name'),
                    'trim': trim,
                    'offerType': 'financing',
                    'aprRate': apr,
                    'aprTermMonths': term_months,
                    'leaseMonthlyPayment': None,  # Not extracted for financing offers
                    'cashValue': cash_back,
                    'expirationDate': expiration_date.isoformat() if expiration_date else None,
                    'terms': disclaimer_text,
                    'finePrint': disclaimer_text,
                    'source_url': source_url,
                }
        except Exception as e:
            print(f"      Error extracting finance offer: {e}")
        return None

    def _extract_lease_offer(self, card, model_info: Dict, trim: Optional[str], expiration_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """Extract lease offer data from card element"""
        try:
            card_text = card.get_text()
            
            # Extract monthly payment
            monthly_payment = None
            monthly_block = card.find('div', class_='io-large-block')
            if monthly_block:
                monthly_payment = self.extract_monthly_payment(monthly_block.get_text())
            
            # Extract due at signing
            due_at_signing = self.extract_due_at_signing(card_text)
            
            # Extract term months
            term_months = self.extract_term_months(card_text)
            
            # Extract miles per year
            # The miles appear in an io-large div before "Annual miles" text
            miles_per_year = None
            card_text_lower = card_text.lower()
            if 'annual miles' in card_text_lower:
                # Find all io-large divs and check which one contains miles
                large_divs = card.find_all('div', class_='io-large')
                for large_div in large_divs:
                    div_text = large_div.get_text().strip()
                    # Check if this appears before "Annual miles" in the card text
                    div_index = card_text.find(div_text)
                    annual_index = card_text.find('Annual miles', div_index)
                    if annual_index > div_index and annual_index < div_index + 100:
                        # This is likely the miles per year
                        miles_per_year = self.extract_miles_per_year(div_text)
                        break
            
            # Extract terms/fine print
            terms = self.clean_html_text(card_text)
            
            if monthly_payment or due_at_signing:
                return {
                    'brand': self.brand,
                    'year': model_info.get('year'),
                    'make': 'Lincoln',
                    'model': model_info.get('name'),
                    'trim': trim,
                    'offerType': 'lease',
                    'leaseMonthlyPayment': monthly_payment,
                    'leaseDueAtSigning': due_at_signing,
                    'leaseTermMonths': term_months,
                    'milesPerYear': miles_per_year,
                    'expirationDate': expiration_date.isoformat() if expiration_date else None,
                    'terms': terms,
                    'finePrint': None
                }
        except Exception as e:
            print(f"      Error extracting lease offer: {e}")
        return None

    def _extract_finance_offer(self, card, model_info: Dict, trim: Optional[str], expiration_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """Extract finance offer (Retail Offer) data from card element"""
        try:
            card_text = card.get_text()
            
            # Extract APR
            apr = None
            large_div = card.find('div', class_='io-large')
            if large_div:
                apr = self.extract_apr(large_div.get_text())
            
            # Extract term months
            term_months = self.extract_term_months(card_text)
            
            # Extract monthly payment
            monthly_payment = None
            monthly_block = card.find('div', class_='io-large-block')
            if monthly_block:
                monthly_payment = self.extract_monthly_payment(monthly_block.get_text())
            
            # Extract down payment (this is cash back)
            cash_back = self.extract_down_payment(card_text)
            
            # Extract terms
            terms = self.clean_html_text(card_text)
            
            if apr or monthly_payment:
                return {
                    'brand': self.brand,
                    'year': model_info.get('year'),
                    'make': 'Lincoln',
                    'model': model_info.get('name'),
                    'trim': trim,
                    'offerType': 'financing',
                    'aprRate': apr,
                    'aprTermMonths': term_months,
                    'leaseMonthlyPayment': monthly_payment,
                    'cashValue': cash_back,  # Down payment is cash back
                    'expirationDate': expiration_date.isoformat() if expiration_date else None,
                    'terms': terms,
                    'finePrint': None
                }
        except Exception as e:
            print(f"      Error extracting finance offer: {e}")
        return None

    def _extract_cash_offer(self, card, model_info: Dict, trim: Optional[str], expiration_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """Extract cash offer (Purchase) data from card element"""
        try:
            card_text = card.get_text()
            
            # Extract cash back (Retail Incentive)
            # Look for the incentive value in the io-large div that shows "$1,000"
            cash_back = None
            large_divs = card.find_all('div', class_='io-large')
            for large_div in large_divs:
                div_text = large_div.get_text().strip()
                # Check if this div contains an incentive (has $ and is before "Retail Incentive" text)
                if '$' in div_text:
                    # Check if "Retail Incentive" appears after this div
                    parent_text = card.get_text()
                    div_index = parent_text.find(div_text)
                    incentive_index = parent_text.find('Retail Incentive', div_index)
                    if incentive_index > div_index and incentive_index < div_index + 200:
                        # This is likely the incentive value
                        cash_back = self.parse_number(div_text)
                        break
            
            # Extract terms
            terms = self.clean_html_text(card_text)
            
            # Create offer even if cash_back is None (might have other info)
            return {
                'brand': self.brand,
                'year': model_info.get('year'),
                'make': 'Lincoln',
                'model': model_info.get('name'),
                'trim': trim,
                'offerType': 'cash',
                'cashValue': cash_back,
                'expirationDate': expiration_date.isoformat() if expiration_date else None,
                'terms': terms,
                'finePrint': None
            }
        except Exception as e:
            print(f"      Error extracting cash offer: {e}")
        return None

    def scrape(self) -> List[Dict[str, Any]]:
        """
        Main scraping method
        Fetches models and scrapes offers for each model
        """
        offers = []
        
        # Step 1: Fetch models
        print("Step 1: Fetching models from Lincoln website...")
        models = self.fetch_models()
        
        if not models:
            print("No models found, cannot proceed with scraping")
            return offers
        
        print(f"\nFound {len(models)} models:")
        for model in models:
            print(f"  - {model['name']} ({model['year'] or 'N/A'})")
        
        # Step 2: Scrape offers for each model
        print("\nStep 2: Scraping offers for each model...")
        if not self.setup_driver():
            print("Failed to setup driver, cannot scrape offers")
            return offers
        
        try:
            for i, model in enumerate(models, 1):
                print(f"\n[{i}/{len(models)}] Processing {model['name']}...")
                model_offers = self.scrape_offers_for_model(model)
                offers.extend(model_offers)
                print(f"  Total offers so far: {len(offers)}")
        finally:
            if self.driver:
                self.driver.quit()
                self.driver = None
        
        self.offers = offers
        return offers

    def send_to_api(self, offers: List[Dict[str, Any]] = None) -> bool:
        """
        Send scraped offers to API endpoint
        
        Args:
            offers: List of offer dictionaries (uses self.offers if not provided)
            
        Returns:
            True if successful, False otherwise
        """
        if offers is None:
            offers = self.offers
        
        if not offers:
            print("No offers to send")
            return False
        
        try:
            print(f"\nSending {len(offers)} offers to API endpoint: {self.api_url}")
            payload = {
                "brand": "Lincoln",
                "source": "lincoln",
                "offers": offers,
            }
            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            print(f"Successfully sent offers to API (status: {response.status_code})")
            return True
        except Exception as e:
            print(f"Error sending offers to API: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    print(f"Response: {e.response.text}")
                except:
                    pass
            return False


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Lincoln Offers Scraper")
    parser.add_argument(
        "--api-url",
        type=str,
        help="API endpoint URL to send scraped data to"
    )
    parser.add_argument(
        "--no-send",
        action="store_true",
        help="Don't send data to API, just print results"
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode (default: True)"
    )
    
    args = parser.parse_args()
    
    scraper = LincolnScraper(api_url=args.api_url)
    
    # Scrape offers
    offers = scraper.scrape()
    
    if not offers:
        print("\nNo offers found")
        return
    
    # Print summary
    print(f"\n=== Scraping Summary ===")
    print(f"Total offers scraped: {len(offers)}")
    
    # Print sample offers
    if offers:
        print("\nSample offers:")
        for i, offer in enumerate(offers[:3], 1):
            print(f"\n{i}. {offer.get('brand')} {offer.get('year')} {offer.get('make')} {offer.get('model')}")
            print(f"   Type: {offer.get('offerType')}")
            if offer.get('leaseMonthlyPayment'):
                print(f"   Monthly Payment: ${offer.get('leaseMonthlyPayment')}")
            if offer.get('aprRate'):
                print(f"   APR: {offer.get('aprRate') * 100}%")
            if offer.get('cashValue'):
                print(f"   Cash Value: ${offer.get('cashValue')}")
    
    # Send to API unless --no-send flag is set
    if not args.no_send:
        scraper.send_to_api(offers)
    else:
        print("\n--no-send flag set, skipping API submission")
        print(f"\nSample JSON output:")
        print(json.dumps(offers[:2], indent=2))


if __name__ == "__main__":
    main()
