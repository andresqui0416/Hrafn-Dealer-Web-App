-- Fix set_updated_at() function to handle both camelCase (updatedAt) and snake_case (updated_at) column names
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  has_updated_at_camel BOOLEAN;
  has_updated_at_snake BOOLEAN;
BEGIN
  -- Check if updatedAt (camelCase) column exists
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = TG_RELID 
    AND attname = 'updatedAt' 
    AND attnum > 0 
    AND NOT attisdropped
  ) INTO has_updated_at_camel;
  
  -- Check if updated_at (snake_case) column exists
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = TG_RELID 
    AND attname = 'updated_at' 
    AND attnum > 0 
    AND NOT attisdropped
  ) INTO has_updated_at_snake;
  
  -- Set the appropriate column(s)
  IF has_updated_at_camel THEN
    NEW."updatedAt" := now();
  END IF;
  
  IF has_updated_at_snake THEN
    NEW."updated_at" := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
