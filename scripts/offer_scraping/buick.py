"""
Buick Offers Scraper
Scrapes offer data from Buick API and featured offers from website using ChromeDriver
"""

import json
import re
import time
import sys
import os
import html
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from urllib.parse import unquote

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
except ImportError:
    print("Error: requests is not installed. Please install it with: pip install requests")
    sys.exit(1)


class BuickScraper:
    def __init__(self, api_url: str = None):
        """
        Initialize Buick scraper
        
        Args:
            api_url: API endpoint URL to send scraped data to
        """
        self.api_url = api_url or os.getenv(
            "OFFERS_SCRAPER_API_URL",
            "http://localhost:3000/api/offers/scrape"
        )
        self.driver = None
        self.offers = []
        self.brand = "Buick"
        self.api_data = None

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

    def extract_monthly_payment(self, text: str) -> Optional[float]:
        """Extract monthly payment from text (e.g., '$999/month')"""
        if not text:
            return None
        match = re.search(r'\$([\d,]+)/month', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_term_months(self, text: str) -> Optional[int]:
        """Extract term months from text (e.g., 'for 36 months')"""
        if not text:
            return None
        match = re.search(r'for\s+(\d+)\s+months?', text, re.IGNORECASE)
        if match:
            term = int(match.group(1))
            return term if term > 0 else None
        return None

    def extract_due_at_signing(self, text: str) -> Optional[float]:
        """Extract due at signing amount from text"""
        if not text:
            return None
        match = re.search(r'\$([\d,]+)\s+due\s+at\s+signing', text, re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        return None

    def extract_apr(self, text: str) -> Optional[float]:
        """Extract APR from text (e.g., '0.9% APR' or '0.9% APR&nbsp;')"""
        if not text:
            return None
        
        # Clean HTML entities first
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Look for patterns like "0.9% APR" or "0.9%APR" or "0.9 APR"
        patterns = [
            r'(\d+\.?\d*)\s*%\s*apr',  # "0.9% APR"
            r'(\d+\.?\d*)\s*apr',       # "0.9 APR"
            r'(\d+\.?\d*)\s*%\s*ap',   # "0.9% AP" (partial)
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    apr = float(match.group(1))
                    if 0 <= apr <= 100:
                        return apr / 100  # Convert to decimal
                except:
                    pass
        return None

    def extract_cash_back(self, text: str) -> Optional[float]:
        """Extract cash back or purchase allowance from text"""
        if not text:
            return None
        
        # Clean HTML entities first
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Look for patterns like:
        # "$250 Purchase Allowance"
        # "Plus, an additional $250 Purchase Allowance"
        # "$X,XXX cash back"
        patterns = [
            r'\$([\d,]+)\s+Purchase\s+Allowance',  # "$250 Purchase Allowance"
            r'(?:Plus|an additional|additional)[,\s]+\$([\d,]+)',  # "Plus, an additional $250"
            r'\$([\d,]+)\s+(?:cash\s+back|off|discount)',  # "$X,XXX cash back"
            r'\$([\d,]+)(?:\s+Purchase\s+Allowance)?',  # "$250" or "$250 Purchase Allowance"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return self.parse_number(match.group(1))
                except:
                    pass
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

    def parse_expiration_date(self, date_str: str) -> Optional[str]:
        """Parse expiration date from format 'M-D-YYYY' to ISO format"""
        if not date_str:
            return None
        try:
            parts = date_str.split("-")
            if len(parts) == 3:
                month = int(parts[0])
                day = int(parts[1])
                year = int(parts[2])
                return f"{year}-{month:02d}-{day:02d}"
        except:
            pass
        return None

    def extract_years_from_text(self, text: str) -> List[int]:
        """Extract years from text, handling '&' separator (e.g., '2025 & 2026' or '2025&nbsp;&amp; 2026')"""
        if not text:
            return []
        years = []
        # Handle HTML entities - decode them first
        # Replace &nbsp; with space, &amp; with &, then normalize
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&', ' ')
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Find all 4-digit years (20XX format)
        matches = re.findall(r'\b(20\d{2})\b', text)
        for match in matches:
            try:
                year = int(match)
                if 2020 <= year <= 2030:  # Reasonable range
                    years.append(year)
            except:
                pass
        return sorted(list(set(years)))  # Remove duplicates and sort

    def fetch_api_data(self) -> Optional[Dict]:
        """Fetch offer data from Buick API"""
        try:
            print("Fetching data from Buick API...")
            url = "https://cws.gm.com/cof-cws/v2/currentoffers/US/en/95556?make=buick&quantumHostname=www.buick.com"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            self.api_data = data
            print(f"Fetched {len(data.get('results', []))} offers from API")
            return data
        except Exception as e:
            print(f"Error fetching API data: {e}")
            return None

    def scrape_featured_offers(self, unique_models: List[Dict] = None) -> List[Dict[str, Any]]:
        """Scrape featured offers from Buick website, finding offers for each model by displayName"""
        featured_offers = []
        
        if not self.driver:
            print("ChromeDriver not initialized, cannot scrape featured offers")
            return featured_offers

        if not unique_models:
            print("No model set provided, cannot scrape featured offers")
            return featured_offers

        try:
            print("Scraping featured offers from Buick website...")
            url = "https://www.buick.com/current-offers#?vehicleType=all&requestedPostalcode=95556&postalcode=95556"
            self.driver.get(url)
            time.sleep(5)  # Wait for page to load

            # Wait for offer containers to load
            try:
                WebDriverWait(self.driver, 15).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "gmst-co-offer-details"))
                )
            except TimeoutException:
                print("Timeout waiting for offers to load")
                return featured_offers

            # Expand all collapsed panels to ensure featured offers are visible
            try:
                # Wait a bit for panels to render
                time.sleep(2)
                
                # Find all collapsable panels (both collapsed and expanded)
                all_panels = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    "gmwc-collapsable-panel"
                )
                print(f"Found {len(all_panels)} total panels")
                
                # Expand collapsed panels
                expanded_count = 0
                for panel in all_panels:
                    try:
                        # Check if panel is collapsed
                        class_attr = panel.get_attribute("class") or ""
                        if "collapsed" in class_attr.lower():
                            # Try to find and click the header button
                            try:
                                header_button = panel.find_element(
                                    By.CSS_SELECTOR,
                                    ".gmwc-collapsable-panel-header, .gmst-co-offer-show-hide, button[title*='Show']"
                                )
                                if header_button:
                                    self.driver.execute_script("arguments[0].click();", header_button)
                                    expanded_count += 1
                                    time.sleep(0.3)
                            except:
                                # Try clicking the panel header directly
                                try:
                                    header = panel.find_element(By.CSS_SELECTOR, ".gmwc-collapsable-panel-header")
                                    self.driver.execute_script("arguments[0].click();", header)
                                    expanded_count += 1
                                    time.sleep(0.3)
                                except:
                                    pass
                    except Exception as e:
                        print(f"      Error expanding panel: {e}")
                        continue
                
                if expanded_count > 0:
                    print(f"Expanded {expanded_count} collapsed panels")
                    time.sleep(2)  # Wait for content to load after expansion
            except Exception as e:
                print(f"Note: Could not expand panels: {e}")

            # Find all featured offer containers
            # Look for both the container div and the gmst-vehicle-offers-featured element
            all_featured_containers = self.driver.find_elements(
                By.CSS_SELECTOR, 
                ".gmst-co-offer-item-grid-featured-offer, gmst-vehicle-offers-featured"
            )

            print(f"Found {len(all_featured_containers)} total featured offer containers")
            
            # Debug: Print container info
            if len(all_featured_containers) > 0:
                for i, container in enumerate(all_featured_containers[:3]):  # Print first 3
                    try:
                        container_text = container.text[:200] if container.text else "No text"
                        print(f"  Container {i+1} preview: {container_text}...")
                    except:
                        pass

            # Normalize displayName for matching (remove "Buick" prefix if present)
            def normalize_model_name(name: str) -> str:
                if not name:
                    return ""
                name = str(name).upper().strip()
                # Remove "Buick" prefix
                name = re.sub(r'^BUICK\s+', '', name)
                # Remove "Models" suffix if present
                name = re.sub(r'\s+MODELS?$', '', name)
                return name.strip()
            
            # Track processed containers to avoid duplicates
            processed_container_ids = set()
            
            # For each model, find featured offer containers that match its displayName
            for model_info in unique_models:
                display_name = model_info.get("displayName")
                if not display_name:
                    continue
                
                print(f"\n  Searching for featured offers for model: {display_name}")
                
                display_name_normalized = normalize_model_name(display_name)
                display_name_upper = display_name.upper()
                
                # Find containers that contain this model's displayName
                matching_containers = []
                
                for container in all_featured_containers:
                    try:
                        # Get unique identifier for container to avoid duplicates
                        try:
                            container_id = container.get_attribute("id") or container.get_attribute("data-dtm") or ""
                            # Use location and text as fallback identifier
                            if not container_id:
                                location = container.location
                                container_id = f"{location['x']}_{location['y']}"
                        except:
                            # Fallback: use text hash
                            container_text_preview = (container.text or "")[:100]
                            container_id = str(hash(container_text_preview))
                        
                        # Skip if already processed
                        if container_id in processed_container_ids:
                            continue
                        
                        # Get container text for initial check
                        container_text = container.text.upper()
                        
                        # Check if normalized displayName appears in container text
                        # This handles cases like "Buick Encore GX" matching "Encore GX"
                        model_found = False
                        
                        # First, check if normalized name appears in container text
                        if display_name_normalized and display_name_normalized in container_text:
                            model_found = True
                        elif display_name_upper in container_text:
                            model_found = True
                        
                        # Also check in specific headline elements (.gb-headline4 contains model name)
                        if not model_found:
                            try:
                                headline_elements = container.find_elements(
                                    By.CSS_SELECTOR,
                                    ".gb-headline4, h3.gb-headline4, .gb-headline3, h3.gb-headline3"
                                )
                                for elem in headline_elements:
                                    elem_text = elem.text.upper().strip()
                                    elem_normalized = normalize_model_name(elem_text)
                                    
                                    # Check if normalized names match
                                    if (display_name_normalized and 
                                        (display_name_normalized in elem_normalized or 
                                         elem_normalized in display_name_normalized or
                                         display_name_normalized == elem_normalized)):
                                        model_found = True
                                        break
                                    # Also check original displayName
                                    if display_name_upper in elem_text or elem_text in display_name_upper:
                                        model_found = True
                                        break
                            except Exception as e:
                                print(f"      Error checking headline elements: {e}")
                                pass
                        
                        if model_found:
                            matching_containers.append((container, container_id))
                            print(f"    Found featured offer container for {display_name}")
                    except Exception as e:
                        print(f"      Error checking container: {e}")
                        continue
                
                # Extract featured offers from matching containers for this model
                print(f"    Found {len(matching_containers)} matching containers for {display_name}")
                for i, (container, container_id) in enumerate(matching_containers):
                    # Skip if already processed
                    if container_id in processed_container_ids:
                        print(f"    Skipping container {i+1} (already processed)")
                        continue
                    
                    try:
                        print(f"    Extracting offer {i+1}/{len(matching_containers)} for {display_name}...")
                        featured_offer = self.extract_featured_offer(container)
                        if featured_offer:
                            # Mark container as processed
                            processed_container_ids.add(container_id)
                            
                            print(f"    Successfully extracted featured offer for {display_name}")
                            # Merge model info with featured offer
                            merged_offer = self.merge_offer_data_with_model(featured_offer, model_info)
                            
                            # Handle multiple offers (multiple years)
                            if featured_offer.get("multiple"):
                                print(f"    Found multiple offers (years): {[o.get('year') for o in featured_offer['offers']]}")
                                # Merge each offer in the multiple offers
                                for offer in featured_offer["offers"]:
                                    merged = self.merge_offer_data_with_model(offer, model_info)
                                    featured_offers.append(merged)
                            else:
                                print(f"    Added single featured offer for {display_name} (year: {merged_offer.get('year')})")
                                featured_offers.append(merged_offer)
                        else:
                            print(f"    Warning: extract_featured_offer returned None for container {i+1}")
                    except Exception as e:
                        print(f"    Error extracting featured offer for {display_name}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

            print(f"\nExtracted {len(featured_offers)} total featured offers")
            return featured_offers

        except Exception as e:
            print(f"Error scraping featured offers: {e}")
            import traceback
            traceback.print_exc()
            return featured_offers

    def extract_featured_offer(self, container) -> Optional[Dict[str, Any]]:
        """Extract data from a featured offer container"""
        try:
            print(f"      Extracting featured offer from container...")
            
            # Extract year information - look for paragraph with center alignment inside .gb-body2
            # Structure: <div class="gb-body2"><p style="text-align: center">2025&nbsp;&amp; 2026</p></div>
            # This appears before the headline (model name)
            years = []
            year_text_raw = ""
            
            # Look for the specific structure: .gb-body2 > p[style*='text-align: center']
            year_elements = container.find_elements(
                By.CSS_SELECTOR, 
                ".gb-body2 p[style*='text-align: center'], .gb-body2 p[style*='text-align:center']"
            )
            
            # Also try direct p elements with center alignment
            if not year_elements:
                year_elements = container.find_elements(
                    By.CSS_SELECTOR,
                    "p[style*='text-align: center'], p[style*='text-align:center']"
                )
            
            for year_elem in year_elements:
                try:
                    # Get both text and innerHTML to handle HTML entities
                    year_text = year_elem.text.strip()
                    inner_html = year_elem.get_attribute('innerHTML') or ""
                    
                    # Check if it contains year patterns (2025, 2026, etc.)
                    if re.search(r'\b(20\d{2})\b', year_text) or re.search(r'\b(20\d{2})\b', inner_html):
                        # Use innerHTML if available to preserve &nbsp; and &amp; for proper parsing
                        year_text_raw = inner_html if inner_html else year_text
                        # Extract years from the text (handles &nbsp; and &amp;)
                        extracted_years = self.extract_years_from_text(year_text_raw)
                        if extracted_years:
                            years = extracted_years
                            print(f"      Found years from text: {year_text_raw} -> {years}")
                            break  # Found years, no need to continue
                except Exception as e:
                    print(f"      Error extracting year from element: {e}")
                    pass
            
            # If no years found in specific elements, try extracting from container text
            if not years:
                container_text = container.text
                years = self.extract_years_from_text(container_text)
                if years:
                    year_text_raw = container_text
                    print(f"      Found years from container text: {years}")

            # Don't extract model name from HTML - it will come from API model info when matching
            # Model info will be provided when matching featured offers to API models
            model = None

            # Extract APR from headline elements (where APR is typically displayed)
            # Look for headline5 elements first (e.g., "0.9% APR")
            apr = None
            headline5_elements = container.find_elements(
                By.CSS_SELECTOR,
                ".gb-headline5, h2.gb-headline5"
            )
            
            # Try headline5 elements first (APR is usually here)
            for headline_elem in headline5_elements:
                try:
                    # Get both text and innerHTML to handle HTML entities
                    headline_text = headline_elem.text.strip()
                    headline_html = headline_elem.get_attribute('innerHTML') or ""
                    
                    # Try extracting from text first
                    if headline_text:
                        apr = self.extract_apr(headline_text)
                        if apr is not None:
                            print(f"      Found APR from headline5 text: {headline_text} -> {apr}")
                            break
                    
                    # If not found in text, try innerHTML (handles &nbsp; better)
                    if apr is None and headline_html:
                        # Clean HTML and try again
                        cleaned_html = self.clean_html_text(headline_html)
                        apr = self.extract_apr(cleaned_html)
                        if apr is not None:
                            print(f"      Found APR from headline5 HTML: {cleaned_html} -> {apr}")
                            break
                except Exception as e:
                    print(f"      Error extracting APR from headline5: {e}")
                    continue
            
            # If APR not found in headline5, try other headline elements
            if apr is None:
                headline_elements = container.find_elements(
                    By.CSS_SELECTOR,
                    ".gb-headline4, h3.gb-headline4, .gb-headline, h2.gb-headline, h3.gb-headline"
                )
                for headline_elem in headline_elements:
                    headline_text = headline_elem.text.strip()
                    if headline_text:
                        apr = self.extract_apr(headline_text)
                        if apr is not None:
                            break
            
            # If APR still not found, try container text
            offer_text = container.text
            if apr is None:
                apr = self.extract_apr(offer_text)
                if apr is not None:
                    print(f"      Found APR from container text: {apr}")

            # Extract cash back/purchase allowance from headline elements
            cash_back = None
            # Look for cash back in headline5 elements (e.g., "$250 Purchase Allowance")
            for headline_elem in headline5_elements:
                try:
                    headline_text = headline_elem.text.strip()
                    headline_html = headline_elem.get_attribute('innerHTML') or ""
                    
                    # Try extracting from text
                    if headline_text:
                        cash_back = self.extract_cash_back(headline_text)
                        if cash_back is not None:
                            print(f"      Found cash back from headline5 text: {headline_text} -> ${cash_back}")
                            break
                    
                    # Try innerHTML if not found in text
                    if cash_back is None and headline_html:
                        cleaned_html = self.clean_html_text(headline_html)
                        cash_back = self.extract_cash_back(cleaned_html)
                        if cash_back is not None:
                            print(f"      Found cash back from headline5 HTML: {cleaned_html} -> ${cash_back}")
                            break
                except Exception as e:
                    print(f"      Error extracting cash back from headline5: {e}")
                    continue
            
            # If cash back not found in headline5, try container text
            if cash_back is None:
                cash_back = self.extract_cash_back(offer_text)
                if cash_back is not None:
                    print(f"      Found cash back from container text: ${cash_back}")

            # Extract full description/text from container (similar to gmc.py)
            # Use JavaScript to get innerText/textContent to capture all text including hidden elements
            full_text = ""
            try:
                # Get full text using JavaScript (captures hidden/collapsed text)
                full_text = (
                    self.driver.execute_script(
                        "return (arguments[0].innerText || arguments[0].textContent || '').trim();",
                        container,
                    )
                    or ""
                )
            except Exception as e:
                print(f"      Error getting full text via JavaScript: {e}")
                # Fallback to regular text property
                full_text = container.text or ""

            # Clean up the text - remove button/link labels and other noise
            if full_text:
                try:
                    # Remove button/link text
                    button_elems = container.find_elements(
                        By.CSS_SELECTOR,
                        "button, a, .gb-disclosure button"
                    )
                    button_texts = set()
                    for btn in button_elems:
                        try:
                            btn_text = btn.text.strip()
                            if btn_text and len(btn_text) < 50:  # Only short button labels
                                button_texts.add(btn_text)
                        except:
                            continue

                    for bt in button_texts:
                        if bt and bt in full_text:
                            full_text = full_text.replace(bt, " ")

                    # Remove disclosure markers like "*"
                    full_text = re.sub(r'\s*\*\s*', ' ', full_text)
                    
                    # Remove separator lines
                    full_text = re.sub(r'_{3,}', '\n', full_text)
                    
                    # Normalize whitespace but preserve structure
                    full_text = re.sub(r'[ \t]+', ' ', full_text)  # Normalize spaces/tabs
                    full_text = re.sub(r'\n\s*\n\s*\n+', '\n\n', full_text)  # Normalize multiple newlines
                    full_text = full_text.strip()
                except Exception as e:
                    print(f"      Error cleaning text: {e}")

            # Extract expiration date and fine print from disclosures
            expiration_date = None
            disclosure_elements = container.find_elements(
                By.CSS_SELECTOR,
                ".gmst-co-offer-item-offer-disclosure p, .gmst-co-offer-item-offer-disclosure, .gb-disclosure"
            )
            fine_print_parts = []
            for elem in disclosure_elements:
                try:
                    # Get text from disclosure element
                    text = elem.text.strip()
                    if text:
                        # Remove disclosure button markers
                        text = re.sub(r'\s*\*\s*', '', text).strip()
                        if text and text not in fine_print_parts:
                            fine_print_parts.append(text)
                            # Look for date patterns like "1/2/26" or "01-02-2026" or "1/2/2026"
                            date_match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', text)
                            if date_match and not expiration_date:
                                month, day, year = date_match.groups()
                                if len(year) == 2:
                                    year = "20" + year
                                try:
                                    expiration_date = f"{year}-{int(month):02d}-{int(day):02d}"
                                except:
                                    pass
                except:
                    continue

            # Determine offer type: if APR exists, set as financing, otherwise set as cash
            if apr is not None:
                offer_type = "financing"
            else:
                offer_type = "cash"

            # Use full_text as terms (description), clean fine print
            terms = full_text if full_text else offer_text
            fine_print = "\n".join(fine_print_parts) if fine_print_parts else None

            # Create offer(s) - one for each year if multiple years
            offers = []
            if not years:
                # If no years found, try to match from API data
                years = [None]  # Will be matched later
                print(f"      No years found, will match from API data")
            else:
                if len(years) > 1:
                    print(f"      Found multiple years: {years} - creating {len(years)} separate offers")
                else:
                    print(f"      Found single year: {years[0]}")

            for year in years:
                offer = {
                    "brand": self.brand,
                    "year": year,
                    "make": self.brand,
                    "model": model or None,  # Use None if empty string
                    "modelCode": None,  # Will be matched from API
                    "trim": None,
                    "offerType": offer_type,
                    "offerAmount": None,
                    "apr": apr,
                    "termMonths": None,
                    "cashBack": cash_back,
                    "dueAtSigning": None,
                    "monthlyPayment": None,
                    "milesPerYear": None,
                    "expirationDate": expiration_date,
                    "terms": terms,
                    "finePrint": fine_print,
                    "isFeatured": True,
                }
                offers.append(offer)

            # Return first offer if single year, or all if multiple
            if len(offers) == 1:
                return offers[0]
            else:
                # Return list indicator - will be handled by caller
                # All offers have same fields except year
                return {"multiple": True, "offers": offers}

        except Exception as e:
            print(f"Error extracting featured offer: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_unique_models_from_api(self) -> List[Dict]:
        """Get unique models from API data"""
        if not self.api_data:
            return []
        
        api_results = self.api_data.get("results", [])
        unique_models = {}
        
        for result in api_results:
            # Skip featured offers from API
            if result.get("offerType") == "Featured Offer":
                continue
                
            model_key = (result.get("displayName") or result.get("carline") or "").upper()
            carline = result.get("carline") or ""
            model_year = result.get("modelYear")
            
            if model_key and model_key not in unique_models:
                unique_models[model_key] = {
                    "displayName": result.get("displayName"),
                    "carline": carline,
                    "modelYear": model_year,
                    "trims": result.get("trims", []),
                }
        
        return list(unique_models.values())

    def merge_offer_data_with_model(self, featured: Dict, model_info: Dict) -> Dict:
        """Merge featured offer data with model info from API"""
        merged = featured.copy()
        
        # Use API model info for vehicle details
        featured_year = featured.get("year")
        if featured_year:
            merged["year"] = featured_year
        elif model_info.get("modelYear"):
            try:
                merged["year"] = int(model_info.get("modelYear"))
            except:
                merged["year"] = None
        else:
            merged["year"] = None
            
        # Use displayName as model, carline as modelCode
        merged["model"] = model_info.get("displayName") or featured.get("model")
        merged["modelCode"] = model_info.get("carline") or None
        merged["trim"] = ", ".join(model_info.get("trims", [])) if model_info.get("trims") else None
        
        # Keep featured offer financial terms (APR, cash back, expiration)
        # These are already set in featured dict

        return merged

    def process_api_offers(self) -> List[Dict[str, Any]]:
        """Process regular offers from API data"""
        offers = []
        
        if not self.api_data:
            return offers

        results = self.api_data.get("results", [])
        
        for result in results:
            # Skip featured offers (they'll be handled separately)
            if result.get("offerType") == "Featured Offer":
                continue

            try:
                offer = self.extract_regular_offer(result)
                if offer:
                    offers.append(offer)
            except Exception as e:
                print(f"Error processing API offer: {e}")
                continue

        return offers

    def extract_regular_offer(self, result: Dict) -> Optional[Dict[str, Any]]:
        """Extract offer data from API result"""
        try:
            # Extract basic vehicle information
            brand = "Buick"
            year = int(result.get("modelYear", 0)) if result.get("modelYear") else None
            # Use displayName as model, carline as modelCode
            model = result.get("displayName")  # Use displayName as model
            carline = result.get("carline")  # Use carline as modelCode
            trims = result.get("trims", [])
            trim = ", ".join(trims) if trims else None

            # Map offer type
            offer_type = "cash"
            if result.get("offerType") == "Lease":
                offer_type = "lease"
            elif result.get("offerType") == "Finance":
                offer_type = "financing"
            elif result.get("offerType") == "Cash":
                offer_type = "cash"

            # Extract offer details from offerText
            offer_text = result.get("offerText", {})
            body_text = offer_text.get("body", {}).get("text", "")
            footer_text = offer_text.get("footer", {}).get("text", "")

            # Extract financial details
            monthly_payment = self.extract_monthly_payment(body_text)
            term_months = self.extract_term_months(body_text)
            due_at_signing = self.extract_due_at_signing(body_text)
            apr = self.extract_apr(body_text) or self.extract_apr(footer_text)
            cash_back = self.extract_cash_back(body_text) if offer_type == "cash" else None

            # Extract expiration date
            expiration_date = self.parse_expiration_date(result.get("endEffDate"))

            # Build terms and fine print - clean HTML and normalize
            terms = self.clean_html_text(body_text) if body_text else None
            fine_print = self.clean_html_text(footer_text) if footer_text else None

            # Only create offer if we have meaningful data
            has_valid_data = (
                (offer_type == "lease" and monthly_payment) or
                (offer_type == "financing" and apr is not None) or
                (offer_type == "cash" and cash_back is not None)
            )

            if not has_valid_data:
                return None

            offer = {
                "brand": brand,
                "year": year,
                "make": brand,
                "model": model,
                "modelCode": carline,
                "trim": trim,
                "offerType": offer_type,
                "offerAmount": None,
                "apr": apr,
                "termMonths": term_months,
                "cashBack": cash_back,
                "dueAtSigning": due_at_signing,
                "monthlyPayment": monthly_payment,
                "milesPerYear": None,
                "expirationDate": expiration_date,
                "terms": terms,
                "finePrint": fine_print,
            }

            return offer

        except Exception as e:
            print(f"Error extracting regular offer: {e}")
            import traceback
            traceback.print_exc()
            return None

    def scrape(self) -> List[Dict[str, Any]]:
        """
        Main scraping method
        Fetches API data and scrapes featured offers from website
        """
        offers = []
        
        # Step 1: Fetch API data
        api_data = self.fetch_api_data()
        if not api_data:
            print("Failed to fetch API data")
            return offers

        # Step 2: Process regular offers from API
        print("Processing regular offers from API...")
        regular_offers = self.process_api_offers()
        offers.extend(regular_offers)
        print(f"Processed {len(regular_offers)} regular offers")

        # Step 3: Make model sets from API data
        print("\nCreating model sets from API data...")
        unique_models = self.get_unique_models_from_api()
        print(f"Created model set with {len(unique_models)} unique models")
        # Step 4: Scrape featured offers from website
        if not self.setup_driver():
            print("Failed to setup driver, skipping featured offers")
            self.offers = offers
            return offers

        try:
            featured_offers = self.scrape_featured_offers(unique_models)
            print(f"\nScraped {len(featured_offers)} featured offers from website")
            
            if featured_offers:
                # Featured offers are already matched to models during scraping
                offers.extend(featured_offers)
                print(f"Added {len(featured_offers)} featured offers (already matched to models)")
                print(f"Total offers after adding featured: {len(offers)}")
            else:
                print("No featured offers found to add")
        finally:
            if self.driver:
                self.driver.quit()

        self.offers = offers
        
        # Print summary
        regular_count = len(regular_offers)
        featured_count = len(offers) - regular_count
        print(f"\n=== Scraping Summary ===")
        print(f"Regular offers from API: {regular_count}")
        print(f"Featured offers from website: {featured_count}")
        print(f"Total offers: {len(offers)}")
        print("=======================\n")
        
        return offers

    def send_to_api(self) -> bool:
        """
        Send scraped offers to API endpoint
        """
        if not self.offers:
            print("No offers to send")
            return False

        try:
            payload = {
                "offers": self.offers,
                "scrapedAt": datetime.now(timezone.utc).isoformat(),
                "source": "python_scraper",
                "brand": self.brand,
            }

            print(f"Sending {len(self.offers)} offers to API...")
            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60,
            )

            if response.status_code == 200:
                print("Successfully sent offers to API")
                return True
            else:
                print(f"API returned status {response.status_code}: {response.text}")
                return False

        except Exception as e:
            print(f"Error sending offers to API: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Scrape Buick vehicle offers")
    parser.add_argument(
        "--api-url",
        type=str,
        help="API endpoint URL to send scraped data to",
    )
    parser.add_argument(
        "--no-send",
        action="store_true",
        help="Don't send data to API, just print it",
    )

    args = parser.parse_args()

    scraper = BuickScraper(api_url=args.api_url)

    print("Starting Buick offer scraping...")
    offers = scraper.scrape()

    print(f"\nScraped {len(offers)} total offers")

    if args.no_send:
        print("\nOffers (not sent to API):")
        print(json.dumps(offers, indent=2))
    else:
        success = scraper.send_to_api()
        if success:
            print("\nScraping completed successfully")
            sys.exit(0)
        else:
            print("\nScraping completed with errors")
            sys.exit(1)


if __name__ == "__main__":
    main()

