"""
GMC Offers Scraper using Selenium Chrome Driver
Scrapes offer data from GMC website and sends to API endpoint
"""

import json
import re
import time
import sys
import os
from datetime import datetime
from typing import List, Dict, Optional, Any

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

class GMCScraper:
    def __init__(self, api_url: str = None):
        """
        Initialize GMC scraper
        
        Args:
            api_url: API endpoint URL to send scraped data to
        """
        self.api_url = api_url or os.getenv(
            "OFFERS_SCRAPER_API_URL",
            "http://localhost:3000/api/offers/scrape"
        )
        self.driver = None
        self.offers = []
        self.brand = "GMC"
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
        """Extract APR from text"""
        if not text:
            return None
        match = re.search(r'(\d+\.?\d*)\s*%?\s*apr', text, re.IGNORECASE)
        if match:
            apr = float(match.group(1))
            if 0 <= apr <= 100:
                return apr / 100  # Convert to decimal
        return None

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

    def extract_cash_back(self, text: str) -> Optional[float]:
        """Extract cash back or purchase allowance from text"""
        if not text:
            return None
        
        # Clean HTML entities first
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Look for patterns like:
        # "$X,XXX cash back"
        # "$X,XXX off"
        # "$X,XXX discount"
        patterns = [
            r'\$([\d,]+)\s+(?:cash\s+back|off|discount)',  # "$X,XXX cash back"
            r'\$([\d,]+)\s+Purchase\s+Allowance',  # "$X,XXX Purchase Allowance"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return self.parse_number(match.group(1))
                except:
                    pass
        return None

    def fetch_api_data(self) -> Optional[Dict]:
        """Fetch offer data from GMC API"""
        try:
            print("Fetching data from GMC API...")
            url = "https://cws.gm.com/cof-cws/v2/currentoffers/US/en/95556?make=gmc&quantumHostname=www.gmc.com"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            self.api_data = data
            print(f"Fetched {len(data.get('results', []))} offers from API")
            return data
        except Exception as e:
            print(f"Error fetching API data: {e}")
            return None

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
            brand = "GMC"
            year = int(result.get("modelYear", 0)) if result.get("modelYear") else None
            model = result.get("displayName") or result.get("carline") or None
            carline = result.get("carline") or None
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
            
            # Extract cashBack for cash offers
            cash_back = None
            if offer_type == "cash":
                cash_back_match = re.search(r'\$([\d,]+)\s+(?:cash\s+back|off|discount)', body_text, re.IGNORECASE)
                if cash_back_match:
                    cash_back = self.parse_number(cash_back_match.group(1))

            # Extract expiration date
            expiration_date = self.parse_expiration_date(result.get("endEffDate"))

            # Build terms and fine print
            terms = body_text.strip() if body_text else None
            fine_print = footer_text.strip() if footer_text else None

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
                
            carline = result.get("carline") or ""
            bodystyle = result.get("bodystyle") or carline  # Use bodystyle, fallback to carline
            # Use carline and bodystyle as the unique key
            model_key = f"{carline}:{bodystyle}".upper()
            model_year = result.get("modelYear")
            
            if model_key and model_key not in unique_models:
                unique_models[model_key] = {
                    "displayName": result.get("displayName"),
                    "carline": carline,
                    "bodystyle": bodystyle,
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

    def normalize_offer(self, offer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize and validate offer data to ensure proper types and formats.
        Returns None if offer is invalid.
        """
        if not offer.get("brand") or not offer.get("offerType"):
            return None

        # Normalize offer type
        offer_type = str(offer.get("offerType", "")).lower()
        if offer_type not in ["lease", "financing", "cash"]:
            return None

        # Normalize numeric fields
        def safe_float(value):
            if value is None:
                return None
            try:
                return float(value) if value != "" else None
            except (ValueError, TypeError):
                return None

        def safe_int(value):
            if value is None:
                return None
            try:
                return int(value) if value != "" else None
            except (ValueError, TypeError):
                return None

        # Normalize year
        year = safe_int(offer.get("year"))

        # Normalize monetary fields
        offer_amount = safe_float(offer.get("offerAmount"))
        monthly_payment = safe_float(offer.get("monthlyPayment"))
        due_at_signing = safe_float(offer.get("dueAtSigning"))
        cash_back = safe_float(offer.get("cashBack"))
        trade_discount = safe_float(offer.get("tradeDiscount"))

        # Normalize APR (should be decimal, not percentage)
        apr = safe_float(offer.get("apr"))
        if apr is not None and apr > 1:
            # If APR is provided as percentage (e.g., 2.9), convert to decimal (0.029)
            apr = apr / 100

        # Normalize term months
        term_months = safe_int(offer.get("termMonths"))
        miles_per_year = safe_int(offer.get("milesPerYear"))

        # Normalize expiration date
        expiration_date = offer.get("expirationDate")
        if expiration_date:
            if isinstance(expiration_date, str):
                # Already in ISO format from parse_expiration_date
                pass
            else:
                expiration_date = None

        # Validate offer has meaningful data
        has_valid_data = (
            (offer_type == "lease" and monthly_payment is not None) or
            (offer_type == "financing" and apr is not None) or
            (offer_type == "cash" and (offer_amount is not None or cash_back is not None or trade_discount is not None))
        )

        if not has_valid_data:
            # Debug: log why offer was rejected
            debug_info = {
                "offerType": offer_type,
                "monthlyPayment": monthly_payment,
                "apr": apr,
                "offerAmount": offer_amount,
                "cashBack": cash_back,
                "tradeDiscount": trade_discount,
            }
            print(f"      Debug: Offer rejected - missing required data: {debug_info}")
            return None

        # Don't populate offerAmount from tradeDiscount or cashBack - keep them separate
        # Build normalized offer
        normalized = {
            "brand": str(offer.get("brand", "")).strip(),
            "year": year,
            "make": str(offer.get("make", offer.get("brand", ""))).strip(),
            "model": str(offer.get("model", "")).strip() if offer.get("model") else None,
            "modelCode": str(offer.get("modelCode", "")).strip() if offer.get("modelCode") else None,
            "trim": str(offer.get("trim", "")).strip() if offer.get("trim") else None,
            "offerType": offer_type,
            "offerAmount": offer_amount,
            "apr": apr,
            "termMonths": term_months,
            "cashBack": cash_back,
            "tradeDiscount": trade_discount,
            "dueAtSigning": due_at_signing,
            "monthlyPayment": monthly_payment,
            "milesPerYear": miles_per_year,
            "expirationDate": expiration_date,
            "terms": str(offer.get("terms", "")).strip() if offer.get("terms") else None,
            "finePrint": str(offer.get("finePrint", "")).strip() if offer.get("finePrint") else None,
        }

        # Keep all fields (including None for numeric/date fields that API expects)
        # The API will handle None values appropriately
        return normalized

    def scrape_featured_offers(self, unique_models: List[Dict] = None) -> List[Dict[str, Any]]:
        """Scrape featured offers from GMC website, finding offers for each model by displayName"""
        featured_offers = []
        
        if not self.driver:
            print("ChromeDriver not initialized, cannot scrape featured offers")
            return featured_offers

        if not unique_models:
            print("No model set provided, cannot scrape featured offers")
            return featured_offers

        try:
            print("Scraping featured offers from GMC website...")
            url = "https://www.gmc.com/current-offers#?vehicleType=all&requestedPostalcode=95556&postalcode=95556"
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
                time.sleep(2)
                all_panels = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    "gmwc-collapsable-panel"
                )
                print(f"Found {len(all_panels)} total panels")
                
                expanded_count = 0
                for panel in all_panels:
                    try:
                        class_attr = panel.get_attribute("class") or ""
                        if "collapsed" in class_attr.lower():
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
                    time.sleep(2)
            except Exception as e:
                print(f"Note: Could not expand panels: {e}")

            # Find all featured offer containers
            all_featured_containers = self.driver.find_elements(
                By.CSS_SELECTOR, 
                ".gmst-co-offer-item-grid-featured-offer, gmst-vehicle-offers-featured"
            )

            print(f"Found {len(all_featured_containers)} total featured offer containers")

            # Normalize displayName for matching (remove "GMC" prefix if present)
            def normalize_model_name(name: str) -> str:
                if not name:
                    return ""
                name = str(name).upper().strip()
                # Remove "GMC" prefix
                name = re.sub(r'^GMC\s+', '', name)
                # Remove "Models" suffix if present
                name = re.sub(r'\s+MODELS?$', '', name)
                return name.strip()
            
            # Track processed containers to avoid duplicates
            processed_container_ids = set()
            
            # For each model, find featured offer containers that match its carline and bodystyle
            for model_info in unique_models:
                carline = model_info.get("carline")
                bodystyle = model_info.get("bodystyle")
                display_name = model_info.get("displayName")
                
                if not carline:
                    print(f"\n  Skipping model (no carline): {display_name}")
                    continue
                
                print(f"\n  Searching for featured offers for model: {display_name} (carline: {carline}, bodystyle: {bodystyle})")
                
                # Find containers that match carline and bodystyle attributes
                matching_containers = []
                
                for container in all_featured_containers:
                    try:
                        # Get unique identifier for container to avoid duplicates
                        try:
                            container_id = container.get_attribute("id") or container.get_attribute("data-dtm") or ""
                            if not container_id:
                                location = container.location
                                container_id = f"{location['x']}_{location['y']}"
                        except:
                            container_text_preview = (container.text or "")[:100]
                            container_id = str(hash(container_text_preview))
                        
                        # Skip if already processed
                        if container_id in processed_container_ids:
                            continue
                        
                        # Check carline and bodystyle attributes on the container or its parent elements
                        model_found = False
                        
                        # First, check the container itself (for gmst-vehicle-offers-featured elements)
                        container_carline = container.get_attribute("carline")
                        container_bodystyle = container.get_attribute("bodystyle")
                        
                        if container_carline and container_bodystyle:
                            # Match both carline and bodystyle
                            if (container_carline.lower() == carline.lower() and 
                                container_bodystyle.lower() == bodystyle.lower()):
                                model_found = True
                        elif container_carline:
                            # If only carline is present, match it
                            if container_carline.lower() == carline.lower():
                                model_found = True
                        
                        # If not found, check parent elements or data attributes
                        if not model_found:
                            try:
                                # Check for data-carline and data-bodystyle attributes on child elements
                                data_carline_elems = container.find_elements(
                                    By.CSS_SELECTOR,
                                    f"[data-carline='{carline}'], [data-carline='{carline.lower()}']"
                                )
                                if data_carline_elems:
                                    # Also check bodystyle if available
                                    if bodystyle:
                                        data_bodystyle_elems = container.find_elements(
                                            By.CSS_SELECTOR,
                                            f"[data-bodystyle='{bodystyle}'], [data-bodystyle='{bodystyle.lower()}']"
                                        )
                                        if data_bodystyle_elems:
                                            model_found = True
                                    else:
                                        # If no bodystyle specified, just match carline
                                        model_found = True
                            except Exception as e:
                                print(f"      Error checking data attributes: {e}")
                                pass
                        
                        # If still not found, check parent panel for carline/bodystyle
                        if not model_found:
                            try:
                                # Find parent panel element
                                parent_panel = container.find_element(
                                    By.XPATH,
                                    "./ancestor::gmwc-collapsable-panel[1]"
                                )
                                if parent_panel:
                                    panel_carline = parent_panel.get_attribute("carline")
                                    panel_bodystyle = parent_panel.get_attribute("bodystyle")
                                    
                                    if panel_carline and panel_bodystyle:
                                        if (panel_carline.lower() == carline.lower() and 
                                            panel_bodystyle.lower() == bodystyle.lower()):
                                            model_found = True
                                    elif panel_carline:
                                        if panel_carline.lower() == carline.lower():
                                            model_found = True
                            except Exception as e:
                                # Parent panel not found or error - that's okay
                                pass
                        
                        if model_found:
                            matching_containers.append((container, container_id))
                            print(f"    Found featured offer container for {display_name} (matched by carline/bodystyle)")
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
                        featured_offer = self.extract_featured_offer(container, model_info)
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

    def extract_featured_offer(self, container, model_info: Dict = None) -> Optional[Dict[str, Any]]:
        """
        Extract data from a featured offer container
        Checks for "&" in headline for multiple years
        """
        try:
            print(f"      Extracting featured offer from container...")
            
            # Extract year information from headline (e.g., "2025 GMC CANYON MODELS" or "2025 & 2026 GMC CANYON MODELS")
            years = []
            headline_text = ""
            
            # Look for headline elements (q-headline, q-display2)
            headline_elements = container.find_elements(
                By.CSS_SELECTOR,
                ".q-headline, h1.q-headline, .q-display2, h1.q-display2"
            )
            
            for headline_elem in headline_elements:
                try:
                    headline_text = headline_elem.text.strip()
                    if headline_text:
                        # Check if headline contains "&" (indicates multiple years)
                        has_ampersand = "&" in headline_text or "&amp;" in headline_text or "&nbsp;" in headline_text
                        
                        # Extract all years from headline
                        extracted_years = self.extract_years_from_text(headline_text)
                        if extracted_years:
                            years = extracted_years
                            print(f"      Found years from headline: {headline_text} -> {years}")
                            break
                except Exception as e:
                    print(f"      Error extracting year from headline: {e}")
                    pass
            
            # If no years found in headline, try container text
            if not years:
                container_text = container.text
                years = self.extract_years_from_text(container_text)
                if years:
                    print(f"      Found years from container text: {years}")
            
            # Don't extract model name from HTML - it will come from API model info when matching
            model = None

            # Extract APR from display elements (q-display3 contains APR)
            apr = None
            display_elements = container.find_elements(
                By.CSS_SELECTOR,
                ".q-display3, .q-text, .q-body1, p, span"
            )
            
            for elem in display_elements:
                try:
                    elem_text = elem.text.strip()
                    if not elem_text:
                        continue
                    # Check if it contains APR or percentage
                    if "APR" in elem_text.upper() or ("%" in elem_text and any(c.isdigit() for c in elem_text)):
                        apr = self.extract_apr(elem_text)
                        if apr is not None:
                            print(f"      Found APR: {elem_text} -> {apr}")
                            break
                except Exception as e:
                    print(f"      Error extracting APR: {e}")
                    continue
            
            # Extract cash back if present
            cash_back = None
            container_text = container.text
            cash_back = self.extract_cash_back(container_text)
            if cash_back is not None:
                print(f"      Found cash back: ${cash_back}")

            # Extract full description/text from container
            full_text = ""
            try:
                full_text = (
                    self.driver.execute_script(
                        "return (arguments[0].innerText || arguments[0].textContent || '').trim();",
                        container,
                    )
                    or ""
                )
            except Exception as e:
                print(f"      Error getting full text via JavaScript: {e}")
                full_text = container.text or ""

            # Clean up the text
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
                            if btn_text and len(btn_text) < 50:
                                button_texts.add(btn_text)
                        except:
                            continue

                    for bt in button_texts:
                        if bt and bt in full_text:
                            full_text = full_text.replace(bt, " ")

                    # Remove disclosure markers
                    full_text = re.sub(r'\s*\*\s*', ' ', full_text)
                    full_text = re.sub(r'_{3,}', '\n', full_text)
                    full_text = re.sub(r'[ \t]+', ' ', full_text)
                    full_text = re.sub(r'\n\s*\n\s*\n+', '\n\n', full_text)
                    full_text = full_text.strip()
                except Exception as e:
                    print(f"      Error cleaning text: {e}")

            # Extract expiration date and fine print from disclosures
            expiration_date = None
            fine_print = None
            try:
                disclosure = container.find_element(
                    By.CSS_SELECTOR, "gb-disclosures"
                )
                disclosure_data = disclosure.get_attribute("disclosure-data")
                if disclosure_data:
                    import json
                    try:
                        disclosure_json = json.loads(disclosure_data)
                        disclosure_texts = []
                        for key, value in disclosure_json.items():
                            if isinstance(value, dict) and "content" in value:
                                content = value.get("content", "")
                                if content:
                                    disclosure_texts.append(content)
                        if disclosure_texts:
                            fine_print = " ".join(disclosure_texts)
                            # Look for expiration date in fine print
                            exp_match = re.search(r'by\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', fine_print, re.IGNORECASE)
                            if exp_match:
                                month, day, year_str = exp_match.groups()
                                year_int = int(year_str)
                                if year_int < 100:
                                    year_int += 2000 if year_int < 50 else 1900
                                expiration_date = f"{year_int}-{int(month):02d}-{int(day):02d}"
                    except json.JSONDecodeError:
                        pass
            except:
                pass

            # Determine offer type: if APR exists, set as financing, otherwise set as cash
            if apr is not None:
                offer_type = "financing"
            else:
                offer_type = "cash"

            # Use full_text as terms (description)
            terms = full_text if full_text else None

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
                    "model": model or None,
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
                return {"multiple": True, "offers": offers}

        except Exception as e:
            print(f"Error extracting featured offer: {e}")
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
        Send scraped offers to API endpoint.
        All offers should be normalized before calling this method.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.offers:
            print("No offers to send")
            return False
        
        # Ensure all offers are normalized
        normalized_offers = []
        for offer in self.offers:
            normalized = self.normalize_offer(offer)
            if normalized:
                normalized_offers.append(normalized)
        
        if not normalized_offers:
            print("No valid offers after normalization")
            return False
        
        try:
            from datetime import timezone
            payload = {
                "offers": normalized_offers,
                "scrapedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "source": "python_scraper_gmc",
                "brand": self.brand  # Help API know which brand to delete existing offers for
            }
            
            print(f"Sending {len(normalized_offers)} normalized offers to API: {self.api_url}")
            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60
            )
            
            response.raise_for_status()
            result = response.json()
            
            print(f"Successfully sent offers to API. Response: {result}")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"Error sending data to API: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}")
                print(f"Response body: {e.response.text}")
            return False
        except Exception as e:
            print(f"Unexpected error sending data to API: {e}")
            return False


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape GMC offers and send to API")
    parser.add_argument(
        "--api-url",
        type=str,
        help="API endpoint URL to send scraped data",
        default=os.getenv("OFFERS_SCRAPER_API_URL", "http://localhost:3000/api/offers/scrape")
    )
    parser.add_argument(
        "--no-send",
        action="store_true",
        help="Don't send data to API, just print results"
    )
    
    args = parser.parse_args()
    
    scraper = GMCScraper(api_url=args.api_url)
    offers = scraper.scrape()
    
    print(f"\nScraped {len(offers)} offers")
    
    if args.no_send:
        print("\nOffers (first 3):")
        for offer in offers[:3]:
            print(json.dumps(offer, indent=2))
    else:
        success = scraper.send_to_api()
        if success:
            print("\n✓ Successfully sent offers to API")
            sys.exit(0)
        else:
            print("\n✗ Failed to send offers to API")
            sys.exit(1)


if __name__ == "__main__":
    main()

