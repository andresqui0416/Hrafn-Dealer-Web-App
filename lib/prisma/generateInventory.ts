// Generate random VIN
function generateVIN(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  let vin = "";
  for (let i = 0; i < 17; i++) {
    vin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return vin;
}

// Sample vehicle data
const vehicleMakes = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Tesla",
];
const vehicleModels: Record<string, string[]> = {
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Prius", "Tacoma"],
  Honda: ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "Ridgeline"],
  Ford: ["F-150", "Mustang", "Explorer", "Escape", "Edge", "Bronco"],
  Chevrolet: ["Silverado", "Equinox", "Tahoe", "Malibu", "Traverse", "Blazer"],
  BMW: ["3 Series", "5 Series", "X3", "X5", "X7", "M3"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "S-Class", "G-Class"],
  Audi: ["A4", "A6", "Q5", "Q7", "A3", "Q3"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
};

const bodyStyles = ["Sedan", "SUV", "Truck", "Coupe", "Hatchback", "Wagon"];
const drivetrains = ["FWD", "RWD", "AWD", "4WD"];
const statuses = ["available", "sold", "pending", "unavailable"];

export function generateInventoryItem(userId: string, appId: string, index: number) {
  const make = vehicleMakes[Math.floor(Math.random() * vehicleMakes.length)];
  const models = vehicleModels[make];
  const model = models[Math.floor(Math.random() * models.length)];
  const year = 2020 + Math.floor(Math.random() * 5); // 2020-2024
  const msrp = 20000 + Math.floor(Math.random() * 60000); // $20k - $80k
  const price = msrp - Math.floor(Math.random() * 5000); // Slightly below MSRP
  const mileage = Math.floor(Math.random() * 50000); // 0-50k miles

  return {
    userId,
    appId,
    vin: generateVIN(),
    year,
    make,
    model,
    trim: ["Base", "LE", "XLE", "Limited", "Sport", "Premium"][Math.floor(Math.random() * 6)],
    bodyStyle: bodyStyles[Math.floor(Math.random() * bodyStyles.length)],
    drivetrain: drivetrains[Math.floor(Math.random() * drivetrains.length)],
    msrp: msrp,
    price: price,
    mileage,
    status: statuses[Math.floor(Math.random() * statuses.length)] as
      | "available"
      | "sold"
      | "pending"
      | "unavailable",
  };
}
