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

try:
    from openai import OpenAI
except ImportError:
    print("Warning: openai is not installed. OpenAI classification will be disabled.")
    print("Install it with: pip install openai")
    OpenAI = None


class GMCScraper:
    def __init__(self, api_url: str = None, openai_api_key: str = None):
        """
        Initialize GMC scraper
        
        Args:
            api_url: API endpoint URL to send scraped data to
            openai_api_key: OpenAI API key for classification and extraction
        """
        self.api_url = api_url or os.getenv(
            "OFFERS_SCRAPER_API_URL",
            "http://localhost:3000/api/offers/scrape"
        )
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self.openai_client = None
        if OpenAI and self.openai_api_key:
            try:
                self.openai_client = OpenAI(api_key=self.openai_api_key)
                print("OpenAI client initialized for classification")
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {e}")
        self.driver = None
        self.offers = []
        self.brand = "GMC"

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

    def classify_and_extract_with_openai(self, text: str, offer_type_hint: str = None) -> Optional[Dict[str, Any]]:
        if not self.openai_client or not text:
            return None
        print(f"Classifying and extracting with OpenAI: {text[:20]}...")
        try:
            print(f"Classifying and extracting with OpenAI: {text[:20]}...")
            prompt = f"""You are a data extraction assistant for vehicle offers.
                        Analyze the following vehicle offer text and extract structured information.

                        Return a JSON object with the following fields:
                        - offerType: one of "lease", "financing", or "cash" (if the text looks like a "featured" banner, map it to the closest of these three)
                        - monthlyPayment: monthly payment amount as number, or null
                        - termMonths: lease/finance term in months as integer, or null
                        - dueAtSigning: amount due at signing as number, or null
                        - apr: APR rate as decimal (e.g., 0.029 for 2.9%), or null
                        - offerAmount: cash offer amount or total discount as number, or null
                        - expirationDate: expiration date in YYYY-MM-DD format, or null
                        - cashBack: cash back amount as number, or null
                        - milesPerYear: miles per year for lease as integer, or null

                        Also extract vehicle information when possible:
                        - vehicleYear: 4-digit model year as number (e.g., 2025), or null
                        - vehicleModel: vehicle model name (e.g., "Sierra 1500"), or null
                        - vehicleModelCode: internal model code or line name if mentioned (e.g., "SIERRA-1500"), or null
                        - vehicleTrim: trim or package name (e.g., "Denali", "Elevation"), or null

                        Offer text:
                        {text}

                        {f"Hint: This appears to be a {offer_type_hint} offer." if offer_type_hint else ""}
                        """

            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You extract structured JSON from vehicle offer text. Always respond with a single valid JSON object, no markdown, no comments.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=400,
                response_format={"type": "json_object"},
            )

            # When response_format=json_object is used, the content should already be JSON
            result_text = response.choices[0].message.content.strip()
            
            import json
            extracted = json.loads(result_text)
            
            # Validate and normalize the extracted data
            if "offerType" in extracted and extracted["offerType"] is not None:
                offer_type = str(extracted["offerType"]).lower().strip()
                # Map any unexpected/featured-like labels to one of the three core types
                if offer_type not in ["lease", "financing", "cash"]:
                    if "lease" in offer_type:
                        offer_type = "lease"
                    elif "financ" in offer_type or "apr" in offer_type:
                        offer_type = "financing"
                    elif "cash" in offer_type or "rebate" in offer_type or "bonus" in offer_type:
                        offer_type = "cash"
                    else:
                        # Default based on fields present
                        if extracted.get("monthlyPayment"):
                            offer_type = "lease"
                        elif extracted.get("apr"):
                            offer_type = "financing"
                        else:
                            offer_type = "cash"
                extracted["offerType"] = offer_type
            
            # Convert APR from percentage to decimal if needed
            if extracted.get("apr") is not None:
                apr = extracted["apr"]
                if isinstance(apr, (int, float)) and apr > 1:
                    extracted["apr"] = apr / 100
            
            return extracted
            
        except json.JSONDecodeError as e:
            print(f"      Warning: Failed to parse OpenAI JSON response: {e}")
            print(f"      Raw OpenAI response was: {result_text!r}")
            return None
        except Exception as e:
            print(f"      Warning: OpenAI extraction failed: {e}")
            return None

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

    def scrape_offers_from_website(self) -> List[Dict[str, Any]]:
        """
        Scrape offers from GMC website using Selenium ChromeDriver
        Scrapes both featured offers and regular lease/finance offers
        """
        offers = []
        
        if not self.driver:
            print("Driver not initialized")
            return offers
        
        try:
            # Navigate to GMC offers page with postal code
            url = "https://www.gmc.com/current-offers#?vehicleType=all&requestedPostalcode=95556&postalcode=95556"
            print(f"Navigating to {url}")
            self.driver.get(url)
            
            # Wait for page to load and offers to render
            print("Waiting for page to load...")
            time.sleep(10)  # Initial wait for page load
            
            # Wait for panels that contain vehicle/offer groupings to appear
            try:
                WebDriverWait(self.driver, 30).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "gmwc-collapsable-panel"))
                )
                print("Collapsable panels loaded")
            except TimeoutException:
                print("Timeout waiting for gmwc-collapsable-panel elements")
                return offers
            
            # Wait for offers to render (they load dynamically)
            print("Waiting for offers to render...")
            time.sleep(10)  # Increased wait time for dynamic content
            
            # Scroll to load all content - scroll multiple times to trigger lazy loading
            print("Scrolling to load all offers...")
            for i in range(3):
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                self.driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(1)
            
            # Final wait after scrolling
            time.sleep(3)
            
            # Scrape offers grouped by vehicle from gmwc-collapsable-panel elements
            # Only look at panels that live inside the main results group container.
            print("Scraping offers from gmwc-collapsable-panel elements inside .gmst-co-result-group...")
            try:
                panels = self.driver.find_elements(
                    By.CSS_SELECTOR, ".gmst-co-result-group gmwc-collapsable-panel"
                )
                print(f"Found {len(panels)} gmwc-collapsable-panel elements")
                total_containers = 0

                for panel_idx, panel in enumerate(panels):
                    try:
                        # Vehicle-level info from attributes (year will be inferred per child offer)
                        carline = panel.get_attribute("carline") or ""
                        bodystyle = panel.get_attribute("bodystyle") or ""

                        print(
                            f"  Processing panel {panel_idx + 1}/{len(panels)}: "
                            f"carline='{carline}', bodystyle='{bodystyle}'"
                        )

                        # Derive base model/modelCode/trim from attributes
                        base_model_code = carline or None
                        # Model name: carline turned into a nicer form (don't combine with bodystyle)
                        base_model = None
                        if carline:
                            base_model = carline.replace("-", " ").title()

                        # Within this panel, find all child offer containers.
                        # The actual text is inside ".gmst-co-offer-item-grid-details-container"
                        # which lives under ".gmst-offer-detail-container > .offer-detail-container".
                        offer_containers = panel.find_elements(
                            By.CSS_SELECTOR,
                            ".gmst-offer-detail-container > .offer-detail-container",
                        )
                        total_containers += len(offer_containers)
                        print(
                            f"    Found {len(offer_containers)} offer-detail-container children in this panel"
                        )

                        for idx, container in enumerate(offer_containers):
                            try:
                                print(
                                    f"    Processing offer-detail-container {idx + 1}/{len(offer_containers)} "
                                    f"in panel {panel_idx + 1}"
                                )
                                # Prefer the inner grid container text if present.
                                # Use JavaScript to read innerText/textContent so we can get
                                # collapsed/hidden text as well (Selenium .text only returns visible text).
                                full_text = ""
                                try:
                                    grid = container.find_element(
                                        By.CSS_SELECTOR,
                                        ".gmst-co-offer-item-grid-details-container",
                                    )
                                    full_text = (
                                        self.driver.execute_script(
                                            "return (arguments[0].innerText || arguments[0].textContent || '').trim();",
                                            grid,
                                        )
                                        or ""
                                    )
                                except Exception:
                                    pass

                                # Fallback to container text via JS
                                if not full_text:
                                    full_text = (
                                        self.driver.execute_script(
                                            "return (arguments[0].innerText || arguments[0].textContent || '').trim();",
                                            container,
                                        )
                                        or ""
                                    )

                                # Remove button/link label text (Copy Link, Print Offers, etc.) from full_text
                                if full_text:
                                    try:
                                        button_elems = container.find_elements(
                                            By.CSS_SELECTOR,
                                            "button, a, .gmst-co-offer-copy, .gmst-co-offer-print",
                                        )
                                        button_texts = set()
                                        for btn in button_elems:
                                            try:
                                                btn_text = (
                                                    self.driver.execute_script(
                                                        "return (arguments[0].innerText || arguments[0].textContent || '').trim();",
                                                        btn,
                                                    )
                                                    or ""
                                                )
                                                if btn_text:
                                                    button_texts.add(btn_text)
                                            except Exception:
                                                continue

                                        for bt in button_texts:
                                            if bt and bt in full_text:
                                                full_text = full_text.replace(bt, " ")

                                        # Also remove generic banner labels like "FEATURED OFFER" or "LEASE OFFER"
                                        banner_patterns = [
                                            r"\bFEATURED\s+OFFER\b",
                                            r"\bLEASE\b",
                                        ]
                                        for pattern in banner_patterns:
                                            full_text = re.sub(
                                                pattern, " ", full_text, flags=re.IGNORECASE
                                            )

                                        # Remove separator lines like "_____________________"
                                        full_text = re.sub(r"_{3,}", "\n", full_text)

                                        # Normalize multiple spaces to single space, but preserve newlines
                                        # Replace multiple spaces/tabs with single space, but keep newlines
                                        full_text = re.sub(r"[ \t]+", " ", full_text)  # Normalize spaces/tabs
                                        full_text = re.sub(r"\n\s*\n\s*\n+", "\n\n", full_text)  # Normalize multiple newlines to max 2
                                        full_text = full_text.strip()
                                    except Exception:
                                        pass

                                if not full_text:
                                    print("      Skipping empty container (no visible text)")
                                    continue

                                # Try to get a headline/title for this offer and prepend it to the text
                                headline_text = ""
                                try:
                                    headline_elem = container.find_element(
                                        By.CSS_SELECTOR,
                                        ".gmst-co-offer-item-title, .panel-title, h1, h2, h3",
                                    )
                                    headline_text = headline_elem.text.strip()
                                except Exception:
                                    headline_text = ""

                                combined_text = (
                                    f"{headline_text}\n{full_text}"
                                    if headline_text
                                    else full_text
                                )

                                # Send combined text to OpenAI to classify and extract offer + vehicle data
                                openai_data = self.classify_and_extract_with_openai(
                                    combined_text
                                )

                                # If OpenAI fails, fall back to lightweight regex extraction
                                if not openai_data:
                                    print(
                                        "      OpenAI did not return structured data, falling back to regex extraction"
                                    )
                                    openai_data = {}
                                    # Basic numeric extraction from the combined text
                                    fallback_monthly = self.extract_monthly_payment(
                                        combined_text
                                    )
                                    fallback_term = self.extract_term_months(
                                        combined_text
                                    )
                                    fallback_due = self.extract_due_at_signing(
                                        combined_text
                                    )
                                    fallback_apr = self.extract_apr(combined_text)

                                    # Try to extract cash back amounts from various patterns
                                    cashback_amount = None
                                    # Check for "PURCHASE ALLOWANCE" first
                                    purchase_allowance_match = re.search(
                                        r"\$([\d,]+)\s*PURCHASE\s+ALLOWANCE",
                                        combined_text,
                                        re.IGNORECASE,
                                    )
                                    if purchase_allowance_match:
                                        cashback_amount = self.parse_number(
                                            purchase_allowance_match.group(1)
                                        )
                                    else:
                                        # Check for "Average Finance Savings" style
                                        savings_match = re.search(
                                            r"\$([\d,]+)\s*(?:Average\s+Finance\s+Savings|Finance\s+Savings|Total\s+Savings)",
                                            combined_text,
                                            re.IGNORECASE,
                                        )
                                        if savings_match:
                                            cashback_amount = self.parse_number(
                                                savings_match.group(1)
                                            )

                                    # Infer offerType from what we found
                                    inferred_type = None
                                    if fallback_monthly is not None:
                                        inferred_type = "lease"
                                    elif fallback_apr is not None:
                                        # Financing if APR is present
                                        inferred_type = "financing"
                                    else:
                                        # If there isn't APR, it's cash
                                        inferred_type = "cash"

                                    openai_data["offerType"] = inferred_type
                                    openai_data["monthlyPayment"] = fallback_monthly
                                    openai_data["termMonths"] = fallback_term
                                    openai_data["dueAtSigning"] = fallback_due
                                    openai_data["apr"] = fallback_apr
                                    # For savings-style offers, set cashBack but don't put it in offerAmount
                                    if cashback_amount is not None:
                                        openai_data["cashBack"] = cashback_amount
                                    else:
                                        openai_data["cashBack"] = None
                                    # Don't set offerAmount from monthlyPayment or cashBack - keep them separate
                                    openai_data["offerAmount"] = None
                                    openai_data["expirationDate"] = None
                                    openai_data["milesPerYear"] = None

                                    # If we still couldn't infer an offer type, skip this container
                                    if not openai_data["offerType"]:
                                        print(
                                            "      Regex fallback could not infer offer type, skipping"
                                        )
                                        continue

                                # Vehicle info: prefer panel attributes for model, get year ONLY from headline
                                year = None
                                model = base_model
                                model_code = base_model_code
                                trim = None

                                vehicleTrim = openai_data.get("vehicleTrim") or None
                                if vehicleTrim:
                                    trim = vehicleTrim

                                # Extract trade discount / "Total Value" style amounts from text
                                trade_discount = None
                                try:
                                    total_val_match = re.search(
                                        r"\$([\d,]+)\s*Total\s+Value",
                                        combined_text,
                                        re.IGNORECASE,
                                    )
                                    if total_val_match:
                                        trade_discount = self.parse_number(
                                            total_val_match.group(1)
                                        )
                                except Exception:
                                    trade_discount = None

                                # Handle multi-year headlines like "2025 & 2026 GMC ACADIA MODELS"
                                # ONLY check headline_text for years (not combined_text or full_text)
                                # If there's an "&" in the headline, extract all years and create separate offers
                                years_in_headline = []
                                try:
                                    if headline_text:
                                        # Check if headline contains "&" (indicates multiple years)
                                        has_ampersand = "&" in headline_text
                                        
                                        # Extract all years from headline
                                        years_in_headline = list(
                                            {
                                                int(y)
                                                for y in re.findall(
                                                    r"\b(20[2-3]\d)\b", headline_text
                                                )
                                            }
                                        )
                                        years_in_headline.sort()
                                        
                                        # If there's an "&" but we only found one year, try to find a second one
                                        # This handles edge cases where one year might be in a different format
                                        if has_ampersand and len(years_in_headline) == 1:
                                            # Try to find another year pattern (e.g., "26" might mean "2026")
                                            # Look for 2-digit years near the "&"
                                            parts = headline_text.split("&")
                                            if len(parts) == 2:
                                                # Check both sides of the "&"
                                                for part in parts:
                                                    # Look for 4-digit years
                                                    year_matches = re.findall(r"\b(20[2-3]\d)\b", part)
                                                    for y in year_matches:
                                                        year_int = int(y)
                                                        if year_int not in years_in_headline:
                                                            years_in_headline.append(year_int)
                                                years_in_headline.sort()
                                except Exception:
                                    years_in_headline = []

                                # If we found multiple years (or there's an "&" indicating multiple years), create separate offers
                                if len(years_in_headline) > 1:
                                    # Create one offer per year (all other fields stay the same)
                                    for yr in years_in_headline:
                                        raw_offer = {
                                            "brand": self.brand,
                                            "year": yr,
                                            "make": self.brand,
                                            "model": model,
                                            "modelCode": model_code,
                                            "trim": trim,
                                            "offerType": openai_data.get("offerType"),
                                            "offerAmount": openai_data.get("offerAmount"),
                                            "apr": openai_data.get("apr"),
                                            "termMonths": openai_data.get("termMonths"),
                                            "cashBack": openai_data.get("cashBack"),
                                            "tradeDiscount": trade_discount,
                                            "dueAtSigning": openai_data.get("dueAtSigning"),
                                            "monthlyPayment": openai_data.get("monthlyPayment"),
                                            "milesPerYear": openai_data.get("milesPerYear"),
                                            "expirationDate": openai_data.get("expirationDate"),
                                            "terms": full_text,
                                            "finePrint": None,
                                        }

                                        normalized = self.normalize_offer(raw_offer)
                                        if normalized:
                                            offers.append(normalized)
                                            print(
                                                f"      ✓ Extracted multi-year offer: {normalized.get('offerType')} "
                                                f"- {normalized.get('year')} {normalized.get('model')}"
                                            )
                                        else:
                                            print(
                                                f"      Normalized multi-year offer was invalid for year {yr}, skipping"
                                            )

                                    # We are done with this container, move to the next one
                                    continue

                                # If no multi-year headline, infer a single year from headline only
                                if years_in_headline:
                                    year = years_in_headline[0]

                                # Build a raw offer dict using OpenAI output + vehicle info
                                raw_offer = {
                                    "brand": self.brand,
                                    "year": year,
                                    "make": self.brand,
                                    "model": model,
                                    "modelCode": model_code,
                                    "trim": trim,
                                    "offerType": openai_data.get("offerType"),
                                    "offerAmount": openai_data.get("offerAmount"),
                                    "apr": openai_data.get("apr"),
                                    "termMonths": openai_data.get("termMonths"),
                                    "cashBack": openai_data.get("cashBack"),
                                    "tradeDiscount": trade_discount,
                                    "dueAtSigning": openai_data.get("dueAtSigning"),
                                    "monthlyPayment": openai_data.get("monthlyPayment"),
                                    "milesPerYear": openai_data.get("milesPerYear"),
                                    "expirationDate": openai_data.get("expirationDate"),
                                    "terms": full_text,
                                    "finePrint": None,
                                }

                                normalized = self.normalize_offer(raw_offer)
                                if normalized:
                                    offers.append(normalized)
                                    print(
                                        f"      ✓ Extracted offer: {normalized.get('offerType')} "
                                        f"- {normalized.get('year')} {normalized.get('model')}"
                                    )
                                else:
                                    # More detailed message already printed in normalize_offer
                                    pass

                            except Exception as e:
                                print(
                                    f"      ✗ Error processing offer-detail-container {idx + 1} "
                                    f"in panel {panel_idx + 1}: {e}"
                                )
                                continue

                    except Exception as e:
                        print(f"  ✗ Error processing panel {panel_idx + 1}: {e}")
                        continue

            except Exception as e:
                print(f"Error scraping from .offer-detail-container elements: {e}")
                import traceback
                traceback.print_exc()
            
            print(f"\nTotal containers processed: {total_containers}")
            print(f"Total offers scraped: {len(offers)}")
            if total_containers > len(offers):
                print(f"  ({total_containers - len(offers)} containers were filtered out during normalization)")
                
        except Exception as e:
            print(f"Error scraping from website: {e}")
            import traceback
            traceback.print_exc()
        
        return offers

    def extract_featured_offer(self, featured_element) -> Optional[Dict[str, Any]]:
        """
        Extract data from a featured offer element (gmst-vehicle-offers-featured)
        Featured offers are typically financing offers with APR information
        """
        try:
            # Get attributes from the element
            year_attr = featured_element.get_attribute("year")
            carline = featured_element.get_attribute("carline")
            bodystyle = featured_element.get_attribute("bodystyle")
            offer_url = featured_element.get_attribute("offerurl")
            
            if not carline:
                return None
            
            # Extract model name and year from headline/title (e.g., "2025 GMC CANYON MODELS")
            model_name = None
            year = None
            try:
                headline = featured_element.find_element(
                    By.CSS_SELECTOR, "h1.q-headline, .q-headline.q-display2, h1"
                )
                headline_text = headline.text.strip()
                
                # Extract year from title (usually at the start, e.g., "2025 GMC CANYON MODELS")
                year_match = re.search(r'^(\d{4})\s+', headline_text)
                if year_match:
                    year = int(year_match.group(1))
                elif year_attr:
                    try:
                        year = int(year_attr)
                    except:
                        pass
                
                # Extract model from headline (e.g., "2025 GMC CANYON MODELS" -> "Canyon")
                if "GMC" in headline_text:
                    parts = headline_text.split()
                    for i, part in enumerate(parts):
                        if part.upper() == "GMC" and i + 1 < len(parts):
                            model_name = parts[i + 1].title()
                            break
                if not model_name:
                    model_name = carline.replace("-", " ").title()
            except:
                model_name = carline.replace("-", " ").title()
                # Fallback to attribute if title extraction failed
                if year_attr:
                    try:
                        year = int(year_attr)
                    except:
                        pass
            
            # Extract all text from featured offer for OpenAI analysis
            featured_text = ""
            try:
                text_elements = featured_element.find_elements(
                    By.CSS_SELECTOR, ".q-display3, .q-text, .q-body1, p, span, h1, h2, h3"
                )
                for elem in text_elements:
                    text = elem.text.strip()
                    if text:
                        featured_text += text + " "
                featured_text = featured_text.strip()
            except Exception as e:
                print(f"      Error extracting text: {e}")
            
            # Try OpenAI extraction for featured offers
            openai_extracted_featured = None
            if featured_text and self.openai_client:
                try:
                    openai_extracted_featured = self.classify_and_extract_with_openai(
                        featured_text,
                        offer_type_hint="featured"
                    )
                    if openai_extracted_featured:
                        print(f"      ✓ Used OpenAI to extract featured offer data")
                except Exception as e:
                    print(f"      Warning: OpenAI extraction error: {e}")
            
            # Extract APR - use OpenAI if available, otherwise use regex
            apr_text = None
            apr_value = None
            if openai_extracted_featured and openai_extracted_featured.get("apr"):
                apr_value = openai_extracted_featured.get("apr")
                if apr_value:
                    apr_text = f"{apr_value * 100}% APR" if apr_value < 1 else f"{apr_value}% APR"
            else:
                try:
                    # Look in all text elements
                    text_elements = featured_element.find_elements(
                        By.CSS_SELECTOR, ".q-display3, .q-text, .q-body1, p, span"
                    )
                    for elem in text_elements:
                        text = elem.text.strip()
                        if not text:
                            continue
                        # Check if it contains APR or percentage
                        if "APR" in text.upper() or ("%" in text and any(c.isdigit() for c in text)):
                            apr_text = text
                            apr_value = self.extract_apr(text)
                            if apr_value:
                                break
                except Exception as e:
                    print(f"      Error extracting APR: {e}")
                    pass
            
            # Extract terms/fine print from disclosure
            terms = None
            fine_print = None
            try:
                disclosure = featured_element.find_element(
                    By.CSS_SELECTOR, "gb-disclosures"
                )
                disclosure_data = disclosure.get_attribute("disclosure-data")
                if disclosure_data:
                    import json
                    try:
                        disclosure_json = json.loads(disclosure_data)
                        # Extract content from all disclosures
                        disclosure_texts = []
                        for key, value in disclosure_json.items():
                            if isinstance(value, dict) and "content" in value:
                                content = value.get("content", "")
                                if content:
                                    disclosure_texts.append(content)
                        if disclosure_texts:
                            fine_print = " ".join(disclosure_texts)
                    except json.JSONDecodeError:
                        pass
            except:
                pass
            
            # Extract expiration date from fine print if available
            expiration_date = None
            if fine_print:
                # Look for patterns like "Take new retail delivery by 1/2/26" or "by 1-2-2026"
                exp_match = re.search(r'by\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', fine_print, re.IGNORECASE)
                if exp_match:
                    month, day, year_str = exp_match.groups()
                    year_int = int(year_str)
                    if year_int < 100:
                        year_int += 2000 if year_int < 50 else 1900
                    expiration_date = f"{year_int}-{int(month):02d}-{int(day):02d}"
            
            # Determine offer type - use OpenAI classification if available
            if openai_extracted_featured and openai_extracted_featured.get("offerType"):
                offer_type = openai_extracted_featured["offerType"]
            else:
                # Default: featured offers are usually financing
                offer_type = "financing" if apr_value else "cash"
            
            # Build offer data
            year_int = None
            if year:
                try:
                    year_int = int(year)
                except:
                    pass
            
            offer = {
                "brand": self.brand,
                "year": year_int,
                "make": self.brand,
                "model": model_name,
                "modelCode": carline,
                "trim": None,
                "offerType": offer_type,
                "offerAmount": None,
                "apr": apr_value,
                "termMonths": None,
                "cashBack": None,
                "dueAtSigning": None,
                "monthlyPayment": None,
                "milesPerYear": None,
                "expirationDate": openai_extracted_featured.get("expirationDate") if openai_extracted_featured else expiration_date,
                "terms": apr_text or f"Featured offer for {model_name}",
                "finePrint": fine_print,
            }
            
            return offer
            
        except Exception as e:
            print(f"      Error extracting featured offer: {e}")
            import traceback
            traceback.print_exc()
            return None

    def extract_regular_offer(self, offer_item, container) -> Optional[Dict[str, Any]]:
        """
        Extract data from a regular offer item (lease, finance, cash)
        """
        try:
            # Get carline, bodystyle, year from container
            carline = container.get_attribute("carline")
            bodystyle = container.get_attribute("bodystyle")
            
            # Extract offer type from title or data attribute
            offer_type_str = None
            try:
                offer_type_elem = offer_item.find_element(
                    By.CSS_SELECTOR, ".gmst-co-offer-type-item-title"
                )
                offer_type_str = offer_type_elem.text.strip()
            except:
                pass
            
            # Also check data-offertype attribute
            try:
                disclosure_elem = offer_item.find_element(
                    By.CSS_SELECTOR, "[data-offertype]"
                )
                offer_type_str = disclosure_elem.get_attribute("data-offertype")
            except:
                pass
            
            # Map offer type
            offer_type = "cash"
            if offer_type_str:
                offer_type_lower = offer_type_str.lower()
                if "lease" in offer_type_lower:
                    offer_type = "lease"
                elif "finance" in offer_type_lower or "apr" in offer_type_lower:
                    offer_type = "financing"
                elif "cash" in offer_type_lower:
                    offer_type = "cash"
            
            # Extract title/model name and year from title element
            model_name = None
            year = None
            try:
                title_elem = offer_item.find_element(
                    By.CSS_SELECTOR, ".gmst-co-offer-item-title"
                )
                title_text = title_elem.text.strip()
                model_name = title_text
                
                # Extract year from title (usually at the start, e.g., "2026 GMC Canyon Short Crew 2WD Elevation")
                year_match = re.search(r'^(\d{4})\s+', title_text)
                if year_match:
                    year = int(year_match.group(1))
                else:
                    # Try to find year anywhere in the title
                    year_match = re.search(r'\b(\d{4})\b', title_text)
                    if year_match:
                        year_candidate = int(year_match.group(1))
                        # Validate year is reasonable (between 2020 and 2030)
                        if 2020 <= year_candidate <= 2030:
                            year = year_candidate
            except:
                pass
            
            # Fallback: try to get year from container or parent elements
            if not year:
                try:
                    # Check if container has year attribute
                    year_attr = container.get_attribute("year")
                    if year_attr:
                        try:
                            year = int(year_attr)
                        except:
                            pass
                except:
                    pass
            
            # Extract offer body text
            body_text = None
            try:
                body_elem = offer_item.find_element(
                    By.CSS_SELECTOR, ".gmst-co-offer-item-offer-body"
                )
                body_text = body_elem.text.strip()
            except:
                pass
            
            # Extract fine print/disclosure - try multiple selectors
            fine_print = None
            try:
                disclosure_elem = offer_item.find_element(
                    By.CSS_SELECTOR, ".gmst-co-offer-item-offer-disclosure"
                )
                fine_print = disclosure_elem.text.strip()
            except:
                # Try alternative selector
                try:
                    disclosure_elem = offer_item.find_element(
                        By.CSS_SELECTOR, "[data-offertype]"
                    )
                    fine_print = disclosure_elem.text.strip()
                except:
                    pass
            
            # Combine body text and fine print for extraction
            combined_text = ""
            if body_text:
                combined_text += body_text + " "
            if fine_print:
                combined_text += fine_print
            
            # Try OpenAI extraction first, fallback to regex
            openai_extracted_regular = None
            if combined_text and self.openai_client:
                try:
                    openai_extracted_regular = self.classify_and_extract_with_openai(
                        combined_text, 
                        offer_type_hint=offer_type
                    )
                    if openai_extracted_regular:
                        print(f"      ✓ Used OpenAI to extract offer data")
                except Exception as e:
                    print(f"      Warning: OpenAI extraction error: {e}")
            
            # Extract offer details - use OpenAI results if available, otherwise use regex
            cash_back = None
            miles_per_year = None
            expiration_date_openai = None
            
            if openai_extracted_regular:
                monthly_payment = openai_extracted_regular.get("monthlyPayment")
                term_months = openai_extracted_regular.get("termMonths")
                due_at_signing = openai_extracted_regular.get("dueAtSigning")
                apr = openai_extracted_regular.get("apr")
                offer_amount = openai_extracted_regular.get("offerAmount")
                cash_back = openai_extracted_regular.get("cashBack")
                miles_per_year = openai_extracted_regular.get("milesPerYear")
                expiration_date_openai = openai_extracted_regular.get("expirationDate")
                
                # Update offer type if OpenAI classified it differently
                if openai_extracted_regular.get("offerType") and openai_extracted_regular["offerType"] != offer_type:
                    offer_type = openai_extracted_regular["offerType"]
            else:
                # Fallback to regex extraction
                monthly_payment = self.extract_monthly_payment(combined_text) if combined_text else None
                term_months = self.extract_term_months(combined_text) if combined_text else None
                due_at_signing = self.extract_due_at_signing(combined_text) if combined_text else None
                apr = self.extract_apr(combined_text) if combined_text else None
                offer_amount = None
            
            # Extract offer ID if available
            offer_id = None
            try:
                # Try to find parent with offerid attribute
                parent = offer_item.find_element(By.XPATH, "./ancestor::div[@offerid]")
                offer_id = parent.get_attribute("offerid")
            except:
                # Try alternative: look for offer-detail-container
                try:
                    parent = offer_item.find_element(By.XPATH, "./ancestor::div[contains(@class, 'offer-detail-container')]")
                    offer_id = parent.get_attribute("offerid")
                except:
                    pass
            
            # Extract expiration date - use OpenAI result if available, otherwise parse from fine print
            expiration_date = expiration_date_openai if expiration_date_openai else None
            if not expiration_date and fine_print:
                # Look for patterns like "Take new retail delivery by 01-02-2026" or "by 1/2/26"
                exp_patterns = [
                    r'by\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
                    r'delivery\s+by\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
                    r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
                ]
                for pattern in exp_patterns:
                    exp_match = re.search(pattern, fine_print, re.IGNORECASE)
                    if exp_match:
                        month, day, year_str = exp_match.groups()
                        try:
                            year_int = int(year_str)
                            if year_int < 100:
                                year_int += 2000 if year_int < 50 else 1900
                            expiration_date = f"{year_int}-{int(month):02d}-{int(day):02d}"
                            break
                        except:
                            pass
            
            # Don't populate offerAmount from monthlyPayment, cashBack, or cash-related text - keep them separate
            # offerAmount should only be set if explicitly extracted from the offer content
            
            # Extract trim from model name if available
            trim = None
            if model_name:
                # Common trim patterns: SLT, Denali, Elevation, AT4, SLE, Pro, Base, etc.
                trim_patterns = [
                    r'\b(SLT|Denali|Elevation|AT4|SLE|Pro|Base|Premium|Luxury|Limited|Sport)\b',
                    r'\b(2X|3X|4X|EV)\b',  # For electric vehicles
                ]
                for pattern in trim_patterns:
                    trim_match = re.search(pattern, model_name, re.IGNORECASE)
                    if trim_match:
                        trim = trim_match.group(1)
                        break
            
            # Build offer data
            if not carline:
                return None
            
            # Clean up model name - remove year if present
            clean_model_name = model_name or carline.replace("-", " ").title()
            if clean_model_name and year:
                # Remove year from model name if it's at the start
                clean_model_name = re.sub(rf'^{year}\s+', '', clean_model_name, flags=re.IGNORECASE)
                clean_model_name = clean_model_name.strip()
            
            offer = {
                "brand": self.brand,
                "year": year,
                "make": self.brand,
                "model": clean_model_name,
                "modelCode": carline,
                "trim": trim,
                "offerType": offer_type,
                "offerAmount": offer_amount,
                "apr": apr,
                "termMonths": term_months,
                "cashBack": cash_back,
                "dueAtSigning": due_at_signing,
                "monthlyPayment": monthly_payment,
                "milesPerYear": miles_per_year,
                "expirationDate": expiration_date,
                "terms": body_text,
                "finePrint": fine_print,
            }
            
            return offer
            
        except Exception as e:
            print(f"      Error extracting regular offer: {e}")
            import traceback
            traceback.print_exc()
            return None

    def scrape(self, use_website: bool = True) -> List[Dict[str, Any]]:
        """
        Main scraping method
        
        Args:
            use_website: If True, scrape from website using ChromeDriver. Otherwise, use API.
        
        Returns:
            List of offer dictionaries
        """
        # We only support website scraping for GMC now; ignore use_website flag
        offers = []
        if not self.setup_driver():
            print("Failed to setup driver, cannot scrape offers")
            return offers

        print("Scraping from website using ChromeDriver...")
        offers = self.scrape_offers_from_website()
        if self.driver:
            self.driver.quit()
        
        self.offers = offers
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
    offers = scraper.scrape(use_website=True)
    
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

