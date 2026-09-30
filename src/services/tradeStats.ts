/**
 * Trade Statistics — comprehensive country-level trade intelligence.
 * Combines World Bank WITS data patterns, UN Comtrade concepts, and
 * CIA World Factbook trade partner data.
 *
 * This is static reference data (updated annually) that enriches the
 * real-time World Bank API indicators with structural trade context.
 */

export interface TradeProfile {
  iso2: string
  name: string
  // Top export/import partners (% of total)
  topExportPartners: { country: string; pct: number }[]
  topImportPartners: { country: string; pct: number }[]
  // Top exported/imported product categories (HS2-level descriptions)
  topExports: { product: string; pct: number }[]
  topImports: { product: string; pct: number }[]
  // Key metrics
  tradeBalance?: number     // US$ billions (positive = surplus)
  tradeToGDP?: number       // trade openness (%)
  currentAccount?: number   // % of GDP
  // Trade agreements
  tradeBlocs: string[]
  // Currency
  currency: string
  // Economic classification
  incomeGroup: 'high' | 'upper-middle' | 'lower-middle' | 'low'
  // Key dependencies / vulnerabilities
  dependencies?: string[]
}

// ── Major trade profiles (top 50 economies + key geopolitical actors) ─────
export const TRADE_PROFILES: TradeProfile[] = [
  {
    iso2: 'US', name: 'United States',
    topExportPartners: [
      { country: 'Canada', pct: 17.5 }, { country: 'Mexico', pct: 15.8 },
      { country: 'China', pct: 8.5 }, { country: 'Japan', pct: 4.4 },
      { country: 'UK', pct: 4.1 }, { country: 'Germany', pct: 3.4 },
    ],
    topImportPartners: [
      { country: 'China', pct: 16.5 }, { country: 'Mexico', pct: 14.0 },
      { country: 'Canada', pct: 13.2 }, { country: 'Japan', pct: 4.8 },
      { country: 'Germany', pct: 4.6 }, { country: 'South Korea', pct: 3.5 },
    ],
    topExports: [
      { product: 'Refined petroleum', pct: 8.2 }, { product: 'Crude petroleum', pct: 7.1 },
      { product: 'Aircraft & parts', pct: 4.5 }, { product: 'Semiconductors', pct: 4.2 },
      { product: 'Vehicles', pct: 3.8 }, { product: 'Natural gas', pct: 3.5 },
      { product: 'Pharmaceuticals', pct: 3.2 }, { product: 'Medical instruments', pct: 2.8 },
    ],
    topImports: [
      { product: 'Vehicles', pct: 8.5 }, { product: 'Crude petroleum', pct: 5.8 },
      { product: 'Electronics/phones', pct: 5.5 }, { product: 'Computers', pct: 5.2 },
      { product: 'Pharmaceuticals', pct: 4.8 }, { product: 'Semiconductors', pct: 3.5 },
    ],
    tradeBalance: -773, tradeToGDP: 25, currentAccount: -3.0,
    tradeBlocs: ['USMCA', 'WTO', 'APEC'],
    currency: 'USD', incomeGroup: 'high',
    dependencies: ['Rare earth minerals from China', 'TSMC semiconductors', 'OPEC+ oil pricing'],
  },
  {
    iso2: 'CN', name: 'China',
    topExportPartners: [
      { country: 'United States', pct: 16.2 }, { country: 'Hong Kong', pct: 8.3 },
      { country: 'Japan', pct: 4.9 }, { country: 'South Korea', pct: 4.5 },
      { country: 'Vietnam', pct: 3.8 }, { country: 'India', pct: 3.2 },
    ],
    topImportPartners: [
      { country: 'South Korea', pct: 8.4 }, { country: 'Japan', pct: 7.2 },
      { country: 'Australia', pct: 6.8 }, { country: 'United States', pct: 6.5 },
      { country: 'Taiwan', pct: 6.2 }, { country: 'Brazil', pct: 4.5 },
    ],
    topExports: [
      { product: 'Electronics/phones', pct: 9.5 }, { product: 'Computers', pct: 6.2 },
      { product: 'Electrical machinery', pct: 5.8 }, { product: 'Textiles/garments', pct: 4.5 },
      { product: 'Furniture', pct: 2.8 }, { product: 'Vehicles (EV)', pct: 2.5 },
      { product: 'Solar panels', pct: 2.2 }, { product: 'Lithium batteries', pct: 2.0 },
    ],
    topImports: [
      { product: 'Semiconductors', pct: 14.8 }, { product: 'Crude petroleum', pct: 12.5 },
      { product: 'Iron ore', pct: 5.8 }, { product: 'Natural gas (LNG)', pct: 3.5 },
      { product: 'Soybeans', pct: 2.8 }, { product: 'Copper ore', pct: 2.2 },
    ],
    tradeBalance: 823, tradeToGDP: 38, currentAccount: 2.5,
    tradeBlocs: ['RCEP', 'WTO', 'APEC', 'SCO', 'BRICS'],
    currency: 'CNY (RMB)', incomeGroup: 'upper-middle',
    dependencies: ['Taiwan semiconductors', 'Middle East oil', 'Australian iron ore', 'US consumer market'],
  },
  {
    iso2: 'DE', name: 'Germany',
    topExportPartners: [
      { country: 'United States', pct: 9.5 }, { country: 'France', pct: 7.8 },
      { country: 'China', pct: 7.2 }, { country: 'Netherlands', pct: 6.5 },
      { country: 'Poland', pct: 5.2 }, { country: 'Italy', pct: 4.8 },
    ],
    topImportPartners: [
      { country: 'China', pct: 12.1 }, { country: 'Netherlands', pct: 8.8 },
      { country: 'Poland', pct: 6.2 }, { country: 'Italy', pct: 5.5 },
      { country: 'United States', pct: 5.4 }, { country: 'France', pct: 5.2 },
    ],
    topExports: [
      { product: 'Vehicles', pct: 15.5 }, { product: 'Machinery', pct: 12.2 },
      { product: 'Chemicals', pct: 8.5 }, { product: 'Pharmaceuticals', pct: 5.8 },
      { product: 'Electrical equipment', pct: 5.2 }, { product: 'Aircraft parts', pct: 2.5 },
    ],
    topImports: [
      { product: 'Natural gas', pct: 6.2 }, { product: 'Crude petroleum', pct: 5.5 },
      { product: 'Vehicles & parts', pct: 5.2 }, { product: 'Electronics', pct: 4.8 },
      { product: 'Pharmaceuticals', pct: 3.5 }, { product: 'Machinery', pct: 3.2 },
    ],
    tradeBalance: 210, tradeToGDP: 87, currentAccount: 6.0,
    tradeBlocs: ['EU', 'WTO', 'Eurozone'],
    currency: 'EUR', incomeGroup: 'high',
    dependencies: ['Russian gas (transitioning)', 'Chinese EV batteries', 'US defense umbrella'],
  },
  {
    iso2: 'JP', name: 'Japan',
    topExportPartners: [
      { country: 'China', pct: 19.4 }, { country: 'United States', pct: 18.5 },
      { country: 'South Korea', pct: 6.5 }, { country: 'Taiwan', pct: 6.2 },
      { country: 'Hong Kong', pct: 4.8 }, { country: 'Thailand', pct: 4.2 },
    ],
    topImportPartners: [
      { country: 'China', pct: 21.5 }, { country: 'Australia', pct: 10.2 },
      { country: 'United States', pct: 9.8 }, { country: 'Middle East', pct: 8.5 },
      { country: 'South Korea', pct: 4.2 }, { country: 'Taiwan', pct: 3.8 },
    ],
    topExports: [
      { product: 'Vehicles', pct: 22.5 }, { product: 'Machinery', pct: 12.8 },
      { product: 'Semiconductors/equipment', pct: 6.5 }, { product: 'Electronics', pct: 5.8 },
      { product: 'Chemicals', pct: 4.5 }, { product: 'Iron & steel', pct: 3.2 },
    ],
    topImports: [
      { product: 'Crude petroleum', pct: 12.5 }, { product: 'LNG', pct: 8.5 },
      { product: 'Electronics', pct: 6.2 }, { product: 'Machinery', pct: 4.5 },
      { product: 'Pharmaceuticals', pct: 3.8 }, { product: 'Coal', pct: 3.5 },
    ],
    tradeBalance: -45, tradeToGDP: 37, currentAccount: 3.5,
    tradeBlocs: ['RCEP', 'CPTPP', 'WTO', 'APEC', 'Quad'],
    currency: 'JPY', incomeGroup: 'high',
    dependencies: ['Middle East oil/LNG', 'China supply chains', 'US security alliance'],
  },
  {
    iso2: 'GB', name: 'United Kingdom',
    topExportPartners: [
      { country: 'United States', pct: 15.2 }, { country: 'Germany', pct: 9.8 },
      { country: 'Netherlands', pct: 8.5 }, { country: 'Ireland', pct: 6.2 },
      { country: 'France', pct: 6.0 }, { country: 'China', pct: 4.8 },
    ],
    topImportPartners: [
      { country: 'China', pct: 13.5 }, { country: 'Germany', pct: 10.2 },
      { country: 'United States', pct: 9.8 }, { country: 'Netherlands', pct: 6.5 },
      { country: 'Norway', pct: 5.8 }, { country: 'France', pct: 4.5 },
    ],
    topExports: [
      { product: 'Machinery', pct: 12.5 }, { product: 'Vehicles', pct: 8.5 },
      { product: 'Pharmaceuticals', pct: 7.8 }, { product: 'Financial services', pct: 6.5 },
      { product: 'Crude petroleum', pct: 5.2 }, { product: 'Precious metals', pct: 4.8 },
    ],
    topImports: [
      { product: 'Vehicles', pct: 8.5 }, { product: 'Machinery', pct: 7.2 },
      { product: 'Electronics', pct: 5.8 }, { product: 'Natural gas', pct: 5.2 },
      { product: 'Crude petroleum', pct: 4.5 }, { product: 'Pharmaceuticals', pct: 4.2 },
    ],
    tradeBalance: -185, tradeToGDP: 60, currentAccount: -3.2,
    tradeBlocs: ['WTO', 'CPTPP', 'Five Eyes'],
    currency: 'GBP', incomeGroup: 'high',
    dependencies: ['Norwegian gas', 'EU single market access (post-Brexit)', 'US defense/intel'],
  },
  {
    iso2: 'IN', name: 'India',
    topExportPartners: [
      { country: 'United States', pct: 17.5 }, { country: 'UAE', pct: 6.5 },
      { country: 'Netherlands', pct: 3.8 }, { country: 'China', pct: 3.5 },
      { country: 'Bangladesh', pct: 3.2 }, { country: 'Singapore', pct: 3.0 },
    ],
    topImportPartners: [
      { country: 'China', pct: 15.5 }, { country: 'UAE', pct: 7.2 },
      { country: 'Saudi Arabia', pct: 6.8 }, { country: 'United States', pct: 6.5 },
      { country: 'Iraq', pct: 5.2 }, { country: 'Russia', pct: 4.8 },
    ],
    topExports: [
      { product: 'Refined petroleum', pct: 14.5 }, { product: 'Pharmaceuticals', pct: 5.8 },
      { product: 'Gems & jewelry', pct: 5.2 }, { product: 'IT services', pct: 4.8 },
      { product: 'Textiles/garments', pct: 4.5 }, { product: 'Rice', pct: 3.2 },
      { product: 'Chemicals', pct: 3.0 }, { product: 'Iron & steel', pct: 2.8 },
    ],
    topImports: [
      { product: 'Crude petroleum', pct: 22.5 }, { product: 'Gold', pct: 6.5 },
      { product: 'Electronics', pct: 5.8 }, { product: 'Coal', pct: 4.5 },
      { product: 'Diamonds (rough)', pct: 3.8 }, { product: 'Machinery', pct: 3.5 },
    ],
    tradeBalance: -265, tradeToGDP: 45, currentAccount: -2.5,
    tradeBlocs: ['WTO', 'BRICS', 'SCO', 'Quad', 'SAARC'],
    currency: 'INR', incomeGroup: 'lower-middle',
    dependencies: ['Middle East oil (85% imported)', 'China electronics', 'US tech services market'],
  },
  {
    iso2: 'RU', name: 'Russia',
    topExportPartners: [
      { country: 'China', pct: 22.0 }, { country: 'India', pct: 8.5 },
      { country: 'Turkey', pct: 5.2 }, { country: 'South Korea', pct: 3.5 },
      { country: 'Netherlands', pct: 3.2 }, { country: 'Germany', pct: 2.8 },
    ],
    topImportPartners: [
      { country: 'China', pct: 38.5 }, { country: 'Turkey', pct: 5.5 },
      { country: 'Germany', pct: 4.2 }, { country: 'South Korea', pct: 3.8 },
      { country: 'Kazakhstan', pct: 3.2 }, { country: 'Belarus', pct: 3.0 },
    ],
    topExports: [
      { product: 'Crude petroleum', pct: 28.5 }, { product: 'Refined petroleum', pct: 14.2 },
      { product: 'Natural gas (pipeline)', pct: 8.5 }, { product: 'LNG', pct: 4.5 },
      { product: 'Coal', pct: 4.2 }, { product: 'Wheat', pct: 3.5 },
      { product: 'Iron & steel', pct: 3.2 }, { product: 'Aluminum', pct: 2.2 },
    ],
    topImports: [
      { product: 'Vehicles & parts', pct: 12.5 }, { product: 'Electronics', pct: 8.5 },
      { product: 'Machinery', pct: 7.8 }, { product: 'Pharmaceuticals', pct: 5.5 },
      { product: 'Chemicals', pct: 3.8 },
    ],
    tradeBalance: 152, tradeToGDP: 46, currentAccount: 5.5,
    tradeBlocs: ['EAEU', 'BRICS', 'SCO', 'WTO', 'OPEC+'],
    currency: 'RUB', incomeGroup: 'upper-middle',
    dependencies: ['Oil/gas revenue (>40% budget)', 'China for tech imports', 'Western sanctions pressure'],
  },
  {
    iso2: 'SA', name: 'Saudi Arabia',
    topExportPartners: [
      { country: 'China', pct: 18.5 }, { country: 'India', pct: 11.2 },
      { country: 'Japan', pct: 10.5 }, { country: 'South Korea', pct: 8.2 },
      { country: 'United States', pct: 5.5 }, { country: 'UAE', pct: 3.8 },
    ],
    topImportPartners: [
      { country: 'China', pct: 22.5 }, { country: 'United States', pct: 8.5 },
      { country: 'UAE', pct: 6.2 }, { country: 'India', pct: 5.8 },
      { country: 'Germany', pct: 4.2 }, { country: 'Japan', pct: 3.5 },
    ],
    topExports: [
      { product: 'Crude petroleum', pct: 68.5 }, { product: 'Refined petroleum', pct: 8.5 },
      { product: 'Petrochemicals', pct: 5.2 }, { product: 'Plastics', pct: 3.5 },
    ],
    topImports: [
      { product: 'Vehicles', pct: 8.5 }, { product: 'Machinery', pct: 7.5 },
      { product: 'Electronics', pct: 5.8 }, { product: 'Food products', pct: 5.5 },
      { product: 'Iron & steel', pct: 4.2 }, { product: 'Pharmaceuticals', pct: 3.2 },
    ],
    tradeBalance: 158, tradeToGDP: 62, currentAccount: 4.5,
    tradeBlocs: ['OPEC', 'OPEC+', 'WTO', 'GCC'],
    currency: 'SAR', incomeGroup: 'high',
    dependencies: ['Oil price (>60% gov revenue)', 'Asian demand', 'Vision 2030 diversification'],
  },
  {
    iso2: 'BR', name: 'Brazil',
    topExportPartners: [
      { country: 'China', pct: 31.5 }, { country: 'United States', pct: 10.5 },
      { country: 'Argentina', pct: 4.5 }, { country: 'Netherlands', pct: 3.8 },
      { country: 'Spain', pct: 2.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 22.5 }, { country: 'United States', pct: 18.2 },
      { country: 'Germany', pct: 5.5 }, { country: 'Argentina', pct: 5.2 },
      { country: 'India', pct: 3.2 },
    ],
    topExports: [
      { product: 'Soybeans', pct: 12.5 }, { product: 'Iron ore', pct: 11.8 },
      { product: 'Crude petroleum', pct: 11.2 }, { product: 'Beef', pct: 4.5 },
      { product: 'Sugar', pct: 3.8 }, { product: 'Poultry', pct: 3.2 },
      { product: 'Coffee', pct: 2.8 }, { product: 'Pulp/paper', pct: 2.5 },
    ],
    topImports: [
      { product: 'Refined petroleum', pct: 6.5 }, { product: 'Electronics', pct: 5.8 },
      { product: 'Vehicles & parts', pct: 5.2 }, { product: 'Machinery', pct: 4.8 },
      { product: 'Chemicals', pct: 4.2 }, { product: 'Fertilizers', pct: 3.5 },
    ],
    tradeBalance: 62, tradeToGDP: 32, currentAccount: -2.8,
    tradeBlocs: ['Mercosur', 'BRICS', 'WTO'],
    currency: 'BRL', incomeGroup: 'upper-middle',
    dependencies: ['China commodity demand', 'Imported fertilizers (Russia/Belarus)', 'US tech'],
  },
  {
    iso2: 'AU', name: 'Australia',
    topExportPartners: [
      { country: 'China', pct: 32.5 }, { country: 'Japan', pct: 14.2 },
      { country: 'South Korea', pct: 7.5 }, { country: 'India', pct: 5.8 },
      { country: 'United States', pct: 3.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 25.5 }, { country: 'United States', pct: 10.2 },
      { country: 'Japan', pct: 6.5 }, { country: 'South Korea', pct: 4.8 },
      { country: 'Thailand', pct: 4.2 },
    ],
    topExports: [
      { product: 'Iron ore', pct: 28.5 }, { product: 'Coal', pct: 12.5 },
      { product: 'LNG', pct: 11.2 }, { product: 'Gold', pct: 5.5 },
      { product: 'Aluminum/bauxite', pct: 3.2 }, { product: 'Beef', pct: 2.8 },
      { product: 'Wheat', pct: 2.5 },
    ],
    topImports: [
      { product: 'Vehicles', pct: 12.5 }, { product: 'Refined petroleum', pct: 7.5 },
      { product: 'Electronics', pct: 5.8 }, { product: 'Machinery', pct: 4.5 },
      { product: 'Pharmaceuticals', pct: 3.8 },
    ],
    tradeBalance: 85, tradeToGDP: 48, currentAccount: 1.2,
    tradeBlocs: ['RCEP', 'CPTPP', 'AUKUS', 'Quad', 'WTO', 'APEC', 'Five Eyes'],
    currency: 'AUD', incomeGroup: 'high',
    dependencies: ['China iron ore demand', 'Energy export prices', 'US security alliance'],
  },
  {
    iso2: 'KR', name: 'South Korea',
    topExportPartners: [
      { country: 'China', pct: 22.5 }, { country: 'United States', pct: 16.2 },
      { country: 'Vietnam', pct: 8.5 }, { country: 'Japan', pct: 4.8 },
      { country: 'Hong Kong', pct: 4.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 22.8 }, { country: 'United States', pct: 11.5 },
      { country: 'Japan', pct: 8.2 }, { country: 'Australia', pct: 5.5 },
      { country: 'Saudi Arabia', pct: 5.2 },
    ],
    topExports: [
      { product: 'Semiconductors', pct: 18.5 }, { product: 'Vehicles', pct: 8.5 },
      { product: 'Refined petroleum', pct: 5.8 }, { product: 'Ships', pct: 4.5 },
      { product: 'Displays/screens', pct: 3.8 }, { product: 'Lithium batteries', pct: 3.5 },
    ],
    topImports: [
      { product: 'Crude petroleum', pct: 15.5 }, { product: 'Semiconductors', pct: 7.5 },
      { product: 'Natural gas (LNG)', pct: 6.5 }, { product: 'Coal', pct: 3.8 },
      { product: 'Electronics', pct: 3.5 },
    ],
    tradeBalance: 28, tradeToGDP: 80, currentAccount: 4.2,
    tradeBlocs: ['RCEP', 'WTO', 'APEC', 'KORUS FTA'],
    currency: 'KRW', incomeGroup: 'high',
    dependencies: ['Semiconductor cycle', 'Middle East energy', 'China market access', 'North Korea risk'],
  },
  {
    iso2: 'SG', name: 'Singapore',
    topExportPartners: [
      { country: 'China', pct: 14.8 }, { country: 'Hong Kong', pct: 11.2 },
      { country: 'Malaysia', pct: 9.5 }, { country: 'United States', pct: 7.8 },
      { country: 'Indonesia', pct: 6.2 },
    ],
    topImportPartners: [
      { country: 'China', pct: 16.5 }, { country: 'Malaysia', pct: 11.2 },
      { country: 'United States', pct: 9.8 }, { country: 'Taiwan', pct: 7.5 },
      { country: 'Japan', pct: 5.5 },
    ],
    topExports: [
      { product: 'Semiconductors', pct: 22.5 }, { product: 'Refined petroleum', pct: 15.5 },
      { product: 'Electronics', pct: 8.5 }, { product: 'Pharmaceuticals', pct: 5.2 },
      { product: 'Chemicals', pct: 4.5 },
    ],
    topImports: [
      { product: 'Semiconductors', pct: 18.5 }, { product: 'Crude petroleum', pct: 12.5 },
      { product: 'Electronics', pct: 6.5 }, { product: 'Machinery', pct: 4.8 },
    ],
    tradeBalance: 45, tradeToGDP: 318, currentAccount: 18.5,
    tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO', 'APEC'],
    currency: 'SGD', incomeGroup: 'high',
    dependencies: ['Entrepot trade flows', 'Water imports (Malaysia)', 'Global semiconductor demand'],
  },
  {
    iso2: 'TR', name: 'Turkey',
    topExportPartners: [
      { country: 'Germany', pct: 8.5 }, { country: 'United States', pct: 6.2 },
      { country: 'Iraq', pct: 5.8 }, { country: 'UK', pct: 5.5 },
      { country: 'Italy', pct: 4.8 }, { country: 'Russia', pct: 4.2 },
    ],
    topImportPartners: [
      { country: 'Russia', pct: 12.5 }, { country: 'China', pct: 12.2 },
      { country: 'Germany', pct: 7.5 }, { country: 'United States', pct: 4.8 },
      { country: 'India', pct: 3.5 },
    ],
    topExports: [
      { product: 'Vehicles', pct: 14.5 }, { product: 'Machinery', pct: 8.5 },
      { product: 'Textiles/garments', pct: 8.2 }, { product: 'Iron & steel', pct: 6.5 },
      { product: 'Food products', pct: 4.5 },
    ],
    topImports: [
      { product: 'Natural gas', pct: 8.5 }, { product: 'Crude petroleum', pct: 7.5 },
      { product: 'Machinery', pct: 5.8 }, { product: 'Electronics', pct: 4.5 },
      { product: 'Gold', pct: 4.2 }, { product: 'Iron & steel', pct: 3.8 },
    ],
    tradeBalance: -75, tradeToGDP: 65, currentAccount: -5.5,
    tradeBlocs: ['NATO', 'WTO', 'G20', 'EU customs union'],
    currency: 'TRY', incomeGroup: 'upper-middle',
    dependencies: ['Russian/Azeri gas', 'Imported oil', 'EU market access', 'Lira instability'],
  },
  {
    iso2: 'AE', name: 'UAE',
    topExportPartners: [
      { country: 'India', pct: 12.5 }, { country: 'Japan', pct: 8.5 },
      { country: 'China', pct: 8.2 }, { country: 'Saudi Arabia', pct: 5.5 },
      { country: 'South Korea', pct: 4.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 18.5 }, { country: 'India', pct: 8.5 },
      { country: 'United States', pct: 6.2 }, { country: 'Japan', pct: 4.5 },
      { country: 'Germany', pct: 3.8 },
    ],
    topExports: [
      { product: 'Crude petroleum', pct: 35.5 }, { product: 'Refined petroleum', pct: 8.5 },
      { product: 'Gold (re-export)', pct: 6.5 }, { product: 'Diamonds', pct: 4.2 },
      { product: 'Aluminum', pct: 3.5 },
    ],
    topImports: [
      { product: 'Gold', pct: 12.5 }, { product: 'Electronics', pct: 8.5 },
      { product: 'Vehicles', pct: 5.5 }, { product: 'Jewelry', pct: 4.8 },
      { product: 'Machinery', pct: 4.2 },
    ],
    tradeBalance: 95, tradeToGDP: 165, currentAccount: 9.5,
    tradeBlocs: ['GCC', 'OPEC', 'WTO'],
    currency: 'AED', incomeGroup: 'high',
    dependencies: ['Oil prices', 'Re-export/transit hub status', 'South Asian labor'],
  },
  {
    iso2: 'ZA', name: 'South Africa',
    topExportPartners: [
      { country: 'China', pct: 12.5 }, { country: 'Germany', pct: 7.2 },
      { country: 'United States', pct: 6.8 }, { country: 'Japan', pct: 5.5 },
      { country: 'UK', pct: 5.2 }, { country: 'India', pct: 4.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 20.5 }, { country: 'Germany', pct: 8.5 },
      { country: 'United States', pct: 5.5 }, { country: 'India', pct: 5.2 },
      { country: 'Saudi Arabia', pct: 4.8 },
    ],
    topExports: [
      { product: 'Platinum group metals', pct: 12.5 }, { product: 'Gold', pct: 8.5 },
      { product: 'Iron ore', pct: 7.5 }, { product: 'Coal', pct: 7.2 },
      { product: 'Vehicles', pct: 5.5 }, { product: 'Manganese', pct: 4.2 },
    ],
    topImports: [
      { product: 'Crude petroleum', pct: 15.5 }, { product: 'Vehicles', pct: 7.5 },
      { product: 'Electronics', pct: 5.8 }, { product: 'Machinery', pct: 4.5 },
    ],
    tradeBalance: 15, tradeToGDP: 58, currentAccount: -0.5,
    tradeBlocs: ['BRICS', 'SADC', 'AU', 'WTO', 'AfCFTA'],
    currency: 'ZAR', incomeGroup: 'upper-middle',
    dependencies: ['Eskom power grid reliability', 'PGM/mining demand', 'Chinese mineral demand'],
  },
  {
    iso2: 'NG', name: 'Nigeria',
    topExportPartners: [
      { country: 'India', pct: 15.5 }, { country: 'Spain', pct: 12.2 },
      { country: 'France', pct: 7.5 }, { country: 'Netherlands', pct: 6.8 },
      { country: 'United States', pct: 5.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 28.5 }, { country: 'India', pct: 8.5 },
      { country: 'Belgium', pct: 5.5 }, { country: 'United States', pct: 5.2 },
      { country: 'Netherlands', pct: 4.2 },
    ],
    topExports: [
      { product: 'Crude petroleum', pct: 78.5 }, { product: 'LNG', pct: 8.5 },
      { product: 'Cocoa', pct: 2.5 },
    ],
    topImports: [
      { product: 'Refined petroleum', pct: 18.5 }, { product: 'Wheat', pct: 5.5 },
      { product: 'Vehicles', pct: 5.2 }, { product: 'Electronics', pct: 4.8 },
      { product: 'Machinery', pct: 4.5 }, { product: 'Chemicals', pct: 3.8 },
    ],
    tradeBalance: 25, tradeToGDP: 30, currentAccount: -1.5,
    tradeBlocs: ['ECOWAS', 'OPEC', 'AU', 'WTO', 'AfCFTA'],
    currency: 'NGN', incomeGroup: 'lower-middle',
    dependencies: ['Oil revenue (90% exports)', 'Imported refined fuel', 'Food imports', 'FX reserves pressure'],
  },
  {
    iso2: 'TW', name: 'Taiwan',
    topExportPartners: [
      { country: 'China', pct: 25.5 }, { country: 'United States', pct: 15.2 },
      { country: 'Japan', pct: 6.5 }, { country: 'Singapore', pct: 5.8 },
      { country: 'South Korea', pct: 4.5 },
    ],
    topImportPartners: [
      { country: 'China', pct: 19.5 }, { country: 'Japan', pct: 14.5 },
      { country: 'United States', pct: 10.2 }, { country: 'South Korea', pct: 6.5 },
      { country: 'Australia', pct: 4.2 },
    ],
    topExports: [
      { product: 'Semiconductors (TSMC)', pct: 38.5 }, { product: 'Electronics', pct: 12.5 },
      { product: 'Displays', pct: 5.5 }, { product: 'Machinery', pct: 4.8 },
      { product: 'Petrochemicals', pct: 3.5 },
    ],
    topImports: [
      { product: 'Crude petroleum', pct: 10.5 }, { product: 'Semiconductors/equipment', pct: 8.5 },
      { product: 'Natural gas (LNG)', pct: 6.5 }, { product: 'Electronics', pct: 5.2 },
      { product: 'Machinery', pct: 4.5 },
    ],
    tradeBalance: 58, tradeToGDP: 115, currentAccount: 12.5,
    tradeBlocs: ['WTO', 'APEC'],
    currency: 'TWD', incomeGroup: 'high',
    dependencies: ['TSMC concentration risk', 'China market/strait security', 'Energy imports (98%)', 'US security guarantee'],
  },
  {
    iso2: 'FR', name: 'France',
    topExportPartners: [{ country: 'Germany', pct: 14.5 }, { country: 'United States', pct: 8.2 }, { country: 'Italy', pct: 7.8 }, { country: 'Spain', pct: 7.5 }, { country: 'Belgium', pct: 7.2 }],
    topImportPartners: [{ country: 'Germany', pct: 15.8 }, { country: 'China', pct: 9.5 }, { country: 'Italy', pct: 7.8 }, { country: 'Belgium', pct: 7.2 }, { country: 'Spain', pct: 6.5 }],
    topExports: [{ product: 'Aircraft (Airbus)', pct: 9.5 }, { product: 'Vehicles', pct: 5.8 }, { product: 'Pharmaceuticals', pct: 5.5 }, { product: 'Wine/spirits', pct: 3.5 }, { product: 'Luxury goods', pct: 3.2 }],
    topImports: [{ product: 'Crude petroleum', pct: 6.5 }, { product: 'Vehicles', pct: 6.2 }, { product: 'Natural gas', pct: 4.8 }, { product: 'Electronics', pct: 4.5 }],
    tradeBalance: -85, tradeToGDP: 65, currentAccount: -1.0,
    tradeBlocs: ['EU', 'WTO', 'Eurozone'], currency: 'EUR', incomeGroup: 'high',
    dependencies: ['Russian gas (declining)', 'US tech platforms', 'Chinese rare earths'],
  },
  {
    iso2: 'IT', name: 'Italy',
    topExportPartners: [{ country: 'Germany', pct: 12.5 }, { country: 'France', pct: 10.2 }, { country: 'United States', pct: 9.8 }, { country: 'Spain', pct: 5.2 }, { country: 'UK', pct: 4.5 }],
    topImportPartners: [{ country: 'Germany', pct: 15.5 }, { country: 'France', pct: 8.5 }, { country: 'China', pct: 8.2 }, { country: 'Netherlands', pct: 5.5 }, { country: 'Spain', pct: 5.0 }],
    topExports: [{ product: 'Machinery', pct: 14.5 }, { product: 'Vehicles', pct: 5.8 }, { product: 'Pharmaceuticals', pct: 5.2 }, { product: 'Fashion/textiles', pct: 4.5 }, { product: 'Food products', pct: 3.8 }],
    topImports: [{ product: 'Crude petroleum', pct: 7.5 }, { product: 'Natural gas', pct: 5.8 }, { product: 'Vehicles', pct: 5.5 }, { product: 'Electronics', pct: 4.2 }],
    tradeBalance: 45, tradeToGDP: 65, currentAccount: 0.5,
    tradeBlocs: ['EU', 'WTO', 'Eurozone'], currency: 'EUR', incomeGroup: 'high',
    dependencies: ['North African gas pipeline', 'Chinese textile supply chains'],
  },
  {
    iso2: 'CA', name: 'Canada',
    topExportPartners: [{ country: 'United States', pct: 75.0 }, { country: 'China', pct: 4.5 }, { country: 'UK', pct: 3.2 }, { country: 'Japan', pct: 2.5 }],
    topImportPartners: [{ country: 'United States', pct: 48.5 }, { country: 'China', pct: 14.0 }, { country: 'Mexico', pct: 5.8 }, { country: 'Germany', pct: 3.2 }],
    topExports: [{ product: 'Crude petroleum', pct: 22.5 }, { product: 'Vehicles', pct: 8.5 }, { product: 'Natural gas', pct: 4.5 }, { product: 'Gold', pct: 3.8 }, { product: 'Potash', pct: 2.5 }],
    topImports: [{ product: 'Vehicles', pct: 12.5 }, { product: 'Electronics', pct: 5.8 }, { product: 'Machinery', pct: 5.2 }],
    tradeBalance: -15, tradeToGDP: 67, currentAccount: -1.5,
    tradeBlocs: ['USMCA', 'WTO', 'CPTPP', 'APEC'], currency: 'CAD', incomeGroup: 'high',
    dependencies: ['US market concentration (75% exports)', 'Trans Mountain pipeline capacity'],
  },
  {
    iso2: 'MX', name: 'Mexico',
    topExportPartners: [{ country: 'United States', pct: 80.5 }, { country: 'Canada', pct: 2.8 }, { country: 'China', pct: 1.5 }],
    topImportPartners: [{ country: 'United States', pct: 43.5 }, { country: 'China', pct: 18.5 }, { country: 'Japan', pct: 3.8 }, { country: 'South Korea', pct: 3.5 }],
    topExports: [{ product: 'Vehicles', pct: 14.5 }, { product: 'Electronics', pct: 12.5 }, { product: 'Crude petroleum', pct: 6.8 }, { product: 'Machinery', pct: 6.5 }, { product: 'Medical instruments', pct: 3.5 }],
    topImports: [{ product: 'Electronics', pct: 14.5 }, { product: 'Vehicle parts', pct: 8.5 }, { product: 'Refined petroleum', pct: 5.5 }],
    tradeBalance: -12, tradeToGDP: 80, currentAccount: -1.2,
    tradeBlocs: ['USMCA', 'WTO', 'Pacific Alliance'], currency: 'MXN', incomeGroup: 'upper-middle',
    dependencies: ['US market (80% exports)', 'Chinese electronics components', 'Nearshoring boom'],
  },
  {
    iso2: 'ID', name: 'Indonesia',
    topExportPartners: [{ country: 'China', pct: 22.5 }, { country: 'United States', pct: 10.5 }, { country: 'Japan', pct: 8.5 }, { country: 'India', pct: 7.8 }, { country: 'Malaysia', pct: 4.5 }],
    topImportPartners: [{ country: 'China', pct: 26.5 }, { country: 'Singapore', pct: 9.5 }, { country: 'Japan', pct: 7.8 }, { country: 'Malaysia', pct: 5.5 }],
    topExports: [{ product: 'Palm oil', pct: 12.5 }, { product: 'Coal', pct: 11.5 }, { product: 'Nickel/steel', pct: 8.5 }, { product: 'Natural gas', pct: 4.5 }, { product: 'Rubber', pct: 3.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 8.5 }, { product: 'Electronics', pct: 6.5 }, { product: 'Machinery', pct: 5.5 }],
    tradeBalance: 36, tradeToGDP: 44, currentAccount: -0.4,
    tradeBlocs: ['ASEAN', 'RCEP', 'WTO', 'G20'], currency: 'IDR', incomeGroup: 'upper-middle',
    dependencies: ['China demand for commodities', 'Nickel processing (EV batteries)', 'Palm oil price volatility'],
  },
  {
    iso2: 'TH', name: 'Thailand',
    topExportPartners: [{ country: 'United States', pct: 17.5 }, { country: 'China', pct: 12.5 }, { country: 'Japan', pct: 8.8 }, { country: 'Vietnam', pct: 4.5 }],
    topImportPartners: [{ country: 'China', pct: 24.5 }, { country: 'Japan', pct: 13.5 }, { country: 'United States', pct: 5.8 }],
    topExports: [{ product: 'Electronics/HDD', pct: 14.5 }, { product: 'Vehicles', pct: 12.5 }, { product: 'Rubber', pct: 4.5 }, { product: 'Rice', pct: 3.2 }],
    topImports: [{ product: 'Crude petroleum', pct: 12.5 }, { product: 'Electronics', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }],
    tradeBalance: 8, tradeToGDP: 130, currentAccount: 1.5,
    tradeBlocs: ['ASEAN', 'RCEP', 'WTO'], currency: 'THB', incomeGroup: 'upper-middle',
    dependencies: ['Japanese auto investment', 'Energy imports', 'Tourism revenue'],
  },
  {
    iso2: 'VN', name: 'Vietnam',
    topExportPartners: [{ country: 'United States', pct: 29.5 }, { country: 'China', pct: 16.5 }, { country: 'Japan', pct: 6.5 }, { country: 'South Korea', pct: 6.2 }],
    topImportPartners: [{ country: 'China', pct: 33.5 }, { country: 'South Korea', pct: 17.5 }, { country: 'Japan', pct: 6.5 }],
    topExports: [{ product: 'Electronics (Samsung)', pct: 32.5 }, { product: 'Textiles', pct: 12.5 }, { product: 'Footwear', pct: 7.5 }, { product: 'Furniture', pct: 4.5 }],
    topImports: [{ product: 'Electronics components', pct: 22.5 }, { product: 'Machinery', pct: 8.5 }, { product: 'Textiles/fabrics', pct: 6.5 }],
    tradeBalance: 12, tradeToGDP: 185, currentAccount: 2.5,
    tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO'], currency: 'VND', incomeGroup: 'lower-middle',
    dependencies: ['Samsung operations (32% of exports)', 'China supply chain', 'US market access'],
  },
  {
    iso2: 'MY', name: 'Malaysia',
    topExportPartners: [{ country: 'Singapore', pct: 14.5 }, { country: 'China', pct: 13.5 }, { country: 'United States', pct: 11.5 }, { country: 'Japan', pct: 6.5 }],
    topImportPartners: [{ country: 'China', pct: 22.5 }, { country: 'Singapore', pct: 12.5 }, { country: 'United States', pct: 8.5 }, { country: 'Japan', pct: 6.5 }],
    topExports: [{ product: 'Electronics', pct: 38.5 }, { product: 'Palm oil', pct: 7.5 }, { product: 'LNG', pct: 6.5 }, { product: 'Rubber', pct: 3.5 }],
    topImports: [{ product: 'Electronics', pct: 25.5 }, { product: 'Refined petroleum', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }],
    tradeBalance: 35, tradeToGDP: 130, currentAccount: 3.5,
    tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO'], currency: 'MYR', incomeGroup: 'upper-middle',
    dependencies: ['Semiconductor OSAT (13% global)', 'Palm oil price', 'Penang tech cluster'],
  },
  {
    iso2: 'PH', name: 'Philippines',
    topExportPartners: [{ country: 'United States', pct: 15.5 }, { country: 'Japan', pct: 14.5 }, { country: 'China', pct: 13.5 }, { country: 'Hong Kong', pct: 8.5 }],
    topImportPartners: [{ country: 'China', pct: 22.5 }, { country: 'Japan', pct: 9.5 }, { country: 'Indonesia', pct: 8.5 }, { country: 'South Korea', pct: 7.5 }],
    topExports: [{ product: 'Electronics', pct: 52.5 }, { product: 'Copper', pct: 3.5 }, { product: 'Coconut oil', pct: 2.5 }],
    topImports: [{ product: 'Electronics', pct: 18.5 }, { product: 'Refined petroleum', pct: 8.5 }, { product: 'Vehicles', pct: 4.5 }],
    tradeBalance: -48, tradeToGDP: 68, currentAccount: -3.5,
    tradeBlocs: ['ASEAN', 'RCEP', 'WTO'], currency: 'PHP', incomeGroup: 'lower-middle',
    dependencies: ['Remittances (10% GDP)', 'Electronics assembly', 'Rice imports'],
  },
  {
    iso2: 'NL', name: 'Netherlands',
    topExportPartners: [{ country: 'Germany', pct: 24.5 }, { country: 'Belgium', pct: 11.5 }, { country: 'France', pct: 8.5 }, { country: 'UK', pct: 6.5 }],
    topImportPartners: [{ country: 'Germany', pct: 14.5 }, { country: 'China', pct: 11.5 }, { country: 'Belgium', pct: 8.5 }, { country: 'United States', pct: 8.2 }],
    topExports: [{ product: 'Refined petroleum', pct: 8.5 }, { product: 'Machinery (ASML)', pct: 7.5 }, { product: 'Chemicals', pct: 6.5 }, { product: 'Food/dairy', pct: 5.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 12.5 }, { product: 'Electronics', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }],
    tradeBalance: 80, tradeToGDP: 165, currentAccount: 7.5,
    tradeBlocs: ['EU', 'WTO', 'Eurozone'], currency: 'EUR', incomeGroup: 'high',
    dependencies: ['ASML EUV monopoly', 'Rotterdam port (Europe\'s largest)', 'Natural gas transition'],
  },
  {
    iso2: 'CH', name: 'Switzerland',
    topExportPartners: [{ country: 'Germany', pct: 15.5 }, { country: 'United States', pct: 14.5 }, { country: 'France', pct: 6.5 }, { country: 'Italy', pct: 6.2 }],
    topImportPartners: [{ country: 'Germany', pct: 20.5 }, { country: 'France', pct: 6.5 }, { country: 'Italy', pct: 6.5 }, { country: 'United States', pct: 6.2 }],
    topExports: [{ product: 'Pharmaceuticals', pct: 32.5 }, { product: 'Gold/precious metals', pct: 18.5 }, { product: 'Watches', pct: 6.5 }, { product: 'Machinery', pct: 5.5 }],
    topImports: [{ product: 'Gold/precious metals', pct: 22.5 }, { product: 'Pharmaceuticals', pct: 8.5 }, { product: 'Vehicles', pct: 4.5 }],
    tradeBalance: 40, tradeToGDP: 120, currentAccount: 7.0,
    tradeBlocs: ['EFTA', 'WTO'], currency: 'CHF', incomeGroup: 'high',
    dependencies: ['Pharma concentration (Novartis, Roche)', 'Gold refining hub', 'EU bilateral agreements'],
  },
  {
    iso2: 'ES', name: 'Spain',
    topExportPartners: [{ country: 'France', pct: 15.5 }, { country: 'Germany', pct: 11.5 }, { country: 'Italy', pct: 8.5 }, { country: 'Portugal', pct: 7.5 }],
    topImportPartners: [{ country: 'Germany', pct: 12.5 }, { country: 'France', pct: 11.5 }, { country: 'China', pct: 9.5 }, { country: 'Italy', pct: 6.5 }],
    topExports: [{ product: 'Vehicles', pct: 14.5 }, { product: 'Food/fruits', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }, { product: 'Pharmaceuticals', pct: 4.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 8.5 }, { product: 'Vehicles', pct: 7.5 }, { product: 'Electronics', pct: 5.5 }],
    tradeBalance: -35, tradeToGDP: 72, currentAccount: 1.5,
    tradeBlocs: ['EU', 'WTO', 'Eurozone'], currency: 'EUR', incomeGroup: 'high',
  },
  {
    iso2: 'PL', name: 'Poland',
    topExportPartners: [{ country: 'Germany', pct: 27.5 }, { country: 'France', pct: 6.5 }, { country: 'Czech Republic', pct: 5.5 }, { country: 'UK', pct: 5.2 }],
    topImportPartners: [{ country: 'Germany', pct: 21.5 }, { country: 'China', pct: 14.5 }, { country: 'Italy', pct: 5.5 }],
    topExports: [{ product: 'Vehicles/parts', pct: 11.5 }, { product: 'Machinery', pct: 8.5 }, { product: 'Electronics', pct: 7.5 }, { product: 'Furniture', pct: 5.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 6.5 }, { product: 'Electronics', pct: 6.5 }, { product: 'Vehicles', pct: 5.5 }],
    tradeBalance: -15, tradeToGDP: 110, currentAccount: -1.5,
    tradeBlocs: ['EU', 'WTO', 'NATO'], currency: 'PLN', incomeGroup: 'high',
    dependencies: ['German auto supply chain', 'Russian energy transition', 'EU structural funds'],
  },
  {
    iso2: 'SE', name: 'Sweden',
    topExportPartners: [{ country: 'Germany', pct: 10.5 }, { country: 'Norway', pct: 10.2 }, { country: 'Denmark', pct: 7.5 }, { country: 'Finland', pct: 6.5 }],
    topImportPartners: [{ country: 'Germany', pct: 18.5 }, { country: 'Netherlands', pct: 8.5 }, { country: 'Norway', pct: 8.2 }],
    topExports: [{ product: 'Vehicles (Volvo)', pct: 8.5 }, { product: 'Machinery', pct: 8.2 }, { product: 'Paper/pulp', pct: 6.5 }, { product: 'Iron ore', pct: 4.5 }],
    topImports: [{ product: 'Vehicles', pct: 8.5 }, { product: 'Crude petroleum', pct: 6.5 }, { product: 'Electronics', pct: 5.5 }],
    tradeBalance: 18, tradeToGDP: 90, currentAccount: 5.5,
    tradeBlocs: ['EU', 'WTO'], currency: 'SEK', incomeGroup: 'high',
  },
  {
    iso2: 'NO', name: 'Norway',
    topExportPartners: [{ country: 'UK', pct: 21.5 }, { country: 'Germany', pct: 15.5 }, { country: 'France', pct: 8.5 }, { country: 'Netherlands', pct: 8.2 }],
    topImportPartners: [{ country: 'Sweden', pct: 12.5 }, { country: 'Germany', pct: 11.5 }, { country: 'China', pct: 10.5 }],
    topExports: [{ product: 'Crude petroleum', pct: 35.5 }, { product: 'Natural gas', pct: 28.5 }, { product: 'Seafood', pct: 6.5 }],
    topImports: [{ product: 'Vehicles', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }],
    tradeBalance: 85, tradeToGDP: 75, currentAccount: 18.5,
    tradeBlocs: ['EEA', 'EFTA', 'WTO'], currency: 'NOK', incomeGroup: 'high',
    dependencies: ['Oil/gas price (64% of exports)', 'Sovereign wealth fund ($1.4T)'],
  },
  {
    iso2: 'IL', name: 'Israel',
    topExportPartners: [{ country: 'United States', pct: 26.5 }, { country: 'China', pct: 8.5 }, { country: 'UK', pct: 6.5 }, { country: 'India', pct: 5.5 }],
    topImportPartners: [{ country: 'China', pct: 14.5 }, { country: 'United States', pct: 11.5 }, { country: 'Turkey', pct: 5.5 }],
    topExports: [{ product: 'Diamonds (cut)', pct: 15.5 }, { product: 'Electronics/tech', pct: 12.5 }, { product: 'Pharmaceuticals', pct: 8.5 }, { product: 'Military equipment', pct: 6.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 8.5 }, { product: 'Diamonds (rough)', pct: 8.5 }, { product: 'Electronics', pct: 6.5 }],
    tradeBalance: -18, tradeToGDP: 60, currentAccount: 4.5,
    tradeBlocs: ['WTO', 'US FTA', 'EU Association'], currency: 'ILS', incomeGroup: 'high',
    dependencies: ['US military aid ($3.8B/yr)', 'Tech sector (Unit 8200 pipeline)', 'Natural gas from Leviathan'],
  },
  {
    iso2: 'EG', name: 'Egypt',
    topExportPartners: [{ country: 'Italy', pct: 8.5 }, { country: 'Turkey', pct: 7.5 }, { country: 'United States', pct: 6.5 }, { country: 'Saudi Arabia', pct: 5.5 }],
    topImportPartners: [{ country: 'China', pct: 15.5 }, { country: 'Saudi Arabia', pct: 7.5 }, { country: 'United States', pct: 6.5 }],
    topExports: [{ product: 'Petroleum products', pct: 22.5 }, { product: 'LNG', pct: 8.5 }, { product: 'Textiles', pct: 5.5 }, { product: 'Suez Canal tolls', pct: 5.0 }],
    topImports: [{ product: 'Wheat', pct: 6.5 }, { product: 'Crude petroleum', pct: 5.5 }, { product: 'Machinery', pct: 4.5 }],
    tradeBalance: -40, tradeToGDP: 42, currentAccount: -3.5,
    tradeBlocs: ['WTO', 'African Union', 'COMESA'], currency: 'EGP', incomeGroup: 'lower-middle',
    dependencies: ['Suez Canal revenue', 'Wheat imports (world\'s largest)', 'Gulf remittances', 'Tourism'],
  },
  {
    iso2: 'IR', name: 'Iran',
    topExportPartners: [{ country: 'China', pct: 30.5 }, { country: 'Iraq', pct: 12.5 }, { country: 'Turkey', pct: 10.5 }, { country: 'UAE', pct: 8.5 }],
    topImportPartners: [{ country: 'China', pct: 28.5 }, { country: 'UAE', pct: 18.5 }, { country: 'Turkey', pct: 8.5 }],
    topExports: [{ product: 'Crude petroleum', pct: 55.5 }, { product: 'Petrochemicals', pct: 12.5 }, { product: 'Iron ore', pct: 3.5 }],
    topImports: [{ product: 'Electronics', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }, { product: 'Vehicles', pct: 5.5 }],
    tradeBalance: 15, tradeToGDP: 40, currentAccount: 2.5,
    tradeBlocs: ['ECO', 'OPEC'], currency: 'IRR', incomeGroup: 'upper-middle',
    dependencies: ['Sanctions evasion via China/UAE', 'Oil price (55% exports)', 'SWIFT exclusion'],
  },
  {
    iso2: 'PK', name: 'Pakistan',
    topExportPartners: [{ country: 'United States', pct: 15.5 }, { country: 'China', pct: 8.5 }, { country: 'UK', pct: 7.5 }, { country: 'Germany', pct: 5.5 }],
    topImportPartners: [{ country: 'China', pct: 28.5 }, { country: 'UAE', pct: 8.5 }, { country: 'Saudi Arabia', pct: 7.5 }],
    topExports: [{ product: 'Textiles/garments', pct: 58.5 }, { product: 'Rice', pct: 8.5 }, { product: 'Leather', pct: 3.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 18.5 }, { product: 'LNG', pct: 6.5 }, { product: 'Machinery', pct: 5.5 }],
    tradeBalance: -28, tradeToGDP: 30, currentAccount: -4.5,
    tradeBlocs: ['WTO', 'ECO'], currency: 'PKR', incomeGroup: 'lower-middle',
    dependencies: ['CPEC (China-Pakistan Economic Corridor)', 'IMF bailouts', 'Energy imports', 'Remittances'],
  },
  {
    iso2: 'BD', name: 'Bangladesh',
    topExportPartners: [{ country: 'United States', pct: 18.5 }, { country: 'Germany', pct: 14.5 }, { country: 'UK', pct: 8.5 }],
    topImportPartners: [{ country: 'China', pct: 25.5 }, { country: 'India', pct: 14.5 }, { country: 'Singapore', pct: 5.5 }],
    topExports: [{ product: 'Garments (RMG)', pct: 84.5 }, { product: 'Footwear', pct: 3.5 }],
    topImports: [{ product: 'Textiles/fabrics', pct: 15.5 }, { product: 'Crude petroleum', pct: 8.5 }, { product: 'Machinery', pct: 5.5 }],
    tradeBalance: -18, tradeToGDP: 42, currentAccount: -1.5,
    tradeBlocs: ['WTO', 'SAARC'], currency: 'BDT', incomeGroup: 'lower-middle',
    dependencies: ['Garment industry (84% exports)', 'Remittances', 'Climate vulnerability'],
  },
  {
    iso2: 'CL', name: 'Chile',
    topExportPartners: [{ country: 'China', pct: 38.5 }, { country: 'United States', pct: 14.5 }, { country: 'Japan', pct: 8.5 }],
    topImportPartners: [{ country: 'China', pct: 24.5 }, { country: 'United States', pct: 18.5 }, { country: 'Brazil', pct: 5.5 }],
    topExports: [{ product: 'Copper', pct: 50.5 }, { product: 'Lithium', pct: 5.5 }, { product: 'Salmon', pct: 4.5 }, { product: 'Wine', pct: 2.5 }],
    topImports: [{ product: 'Crude petroleum', pct: 12.5 }, { product: 'Electronics', pct: 5.5 }, { product: 'Vehicles', pct: 5.5 }],
    tradeBalance: 15, tradeToGDP: 60, currentAccount: -4.5,
    tradeBlocs: ['Pacific Alliance', 'CPTPP', 'WTO'], currency: 'CLP', incomeGroup: 'high',
    dependencies: ['Copper price (50% exports)', 'Lithium nationalization debate', 'China demand'],
  },
  {
    iso2: 'CO', name: 'Colombia',
    topExportPartners: [{ country: 'United States', pct: 26.5 }, { country: 'China', pct: 8.5 }, { country: 'Panama', pct: 6.5 }],
    topImportPartners: [{ country: 'United States', pct: 25.5 }, { country: 'China', pct: 22.5 }, { country: 'Mexico', pct: 5.5 }],
    topExports: [{ product: 'Crude petroleum', pct: 35.5 }, { product: 'Coal', pct: 12.5 }, { product: 'Coffee', pct: 6.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 8.5 }, { product: 'Electronics', pct: 5.5 }, { product: 'Vehicles', pct: 5.5 }],
    tradeBalance: -8, tradeToGDP: 40, currentAccount: -3.5,
    tradeBlocs: ['Pacific Alliance', 'WTO', 'Andean Community'], currency: 'COP', incomeGroup: 'upper-middle',
    dependencies: ['Oil price', 'US market (26% exports)', 'Coal phase-out risk'],
  },
  {
    iso2: 'AR', name: 'Argentina',
    topExportPartners: [{ country: 'Brazil', pct: 15.5 }, { country: 'China', pct: 8.5 }, { country: 'United States', pct: 6.5 }, { country: 'Chile', pct: 5.5 }],
    topImportPartners: [{ country: 'Brazil', pct: 20.5 }, { country: 'China', pct: 18.5 }, { country: 'United States', pct: 10.5 }],
    topExports: [{ product: 'Soybeans/soy meal', pct: 25.5 }, { product: 'Vehicles', pct: 8.5 }, { product: 'Corn', pct: 6.5 }, { product: 'Lithium', pct: 3.5 }],
    topImports: [{ product: 'Natural gas (LNG)', pct: 6.5 }, { product: 'Electronics', pct: 5.5 }, { product: 'Vehicles', pct: 5.5 }],
    tradeBalance: 12, tradeToGDP: 30, currentAccount: -1.0,
    tradeBlocs: ['Mercosur', 'WTO', 'G20'], currency: 'ARS', incomeGroup: 'upper-middle',
    dependencies: ['Soy price', 'Vaca Muerta shale development', 'IMF debt restructuring', 'Lithium triangle potential'],
  },
  {
    iso2: 'QA', name: 'Qatar',
    topExportPartners: [{ country: 'China', pct: 15.5 }, { country: 'Japan', pct: 14.5 }, { country: 'India', pct: 12.5 }, { country: 'South Korea', pct: 12.5 }],
    topImportPartners: [{ country: 'China', pct: 14.5 }, { country: 'United States', pct: 12.5 }, { country: 'UK', pct: 5.5 }],
    topExports: [{ product: 'LNG', pct: 55.5 }, { product: 'Crude petroleum', pct: 18.5 }, { product: 'Petrochemicals', pct: 6.5 }],
    topImports: [{ product: 'Machinery', pct: 12.5 }, { product: 'Vehicles', pct: 6.5 }, { product: 'Electronics', pct: 5.5 }],
    tradeBalance: 55, tradeToGDP: 90, currentAccount: 15.5,
    tradeBlocs: ['GCC', 'OPEC', 'WTO'], currency: 'QAR', incomeGroup: 'high',
    dependencies: ['LNG price (55% exports)', 'North Field expansion', 'Asian LNG demand'],
  },
  {
    iso2: 'KW', name: 'Kuwait',
    topExportPartners: [{ country: 'China', pct: 18.5 }, { country: 'India', pct: 15.5 }, { country: 'Japan', pct: 10.5 }, { country: 'South Korea', pct: 10.5 }],
    topImportPartners: [{ country: 'China', pct: 15.5 }, { country: 'UAE', pct: 10.5 }, { country: 'United States', pct: 8.5 }],
    topExports: [{ product: 'Crude petroleum', pct: 82.5 }, { product: 'Petrochemicals', pct: 5.5 }],
    topImports: [{ product: 'Vehicles', pct: 8.5 }, { product: 'Machinery', pct: 6.5 }, { product: 'Food', pct: 5.5 }],
    tradeBalance: 35, tradeToGDP: 85, currentAccount: 22.5,
    tradeBlocs: ['GCC', 'OPEC', 'WTO'], currency: 'KWD', incomeGroup: 'high',
    dependencies: ['Oil (82% exports)', 'Sovereign wealth fund ($800B+)'],
  },
  {
    iso2: 'KE', name: 'Kenya',
    topExportPartners: [{ country: 'Uganda', pct: 10.5 }, { country: 'Netherlands', pct: 8.5 }, { country: 'United States', pct: 8.5 }, { country: 'Pakistan', pct: 7.5 }],
    topImportPartners: [{ country: 'China', pct: 22.5 }, { country: 'India', pct: 10.5 }, { country: 'UAE', pct: 8.5 }],
    topExports: [{ product: 'Tea', pct: 22.5 }, { product: 'Cut flowers', pct: 8.5 }, { product: 'Coffee', pct: 5.5 }, { product: 'Titanium', pct: 3.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 15.5 }, { product: 'Machinery', pct: 5.5 }, { product: 'Electronics', pct: 4.5 }],
    tradeBalance: -12, tradeToGDP: 38, currentAccount: -5.0,
    tradeBlocs: ['EAC', 'AfCFTA', 'COMESA', 'WTO'], currency: 'KES', incomeGroup: 'lower-middle',
    dependencies: ['Tea/flower prices', 'East African hub role', 'Chinese BRI loans'],
  },
  {
    iso2: 'ET', name: 'Ethiopia',
    topExportPartners: [{ country: 'United States', pct: 10.5 }, { country: 'Saudi Arabia', pct: 8.5 }, { country: 'Germany', pct: 7.5 }],
    topImportPartners: [{ country: 'China', pct: 28.5 }, { country: 'India', pct: 8.5 }, { country: 'United States', pct: 5.5 }],
    topExports: [{ product: 'Coffee', pct: 28.5 }, { product: 'Gold', pct: 12.5 }, { product: 'Flowers', pct: 8.5 }, { product: 'Textiles', pct: 5.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 12.5 }, { product: 'Machinery', pct: 8.5 }, { product: 'Electronics', pct: 5.5 }],
    tradeBalance: -14, tradeToGDP: 25, currentAccount: -4.5,
    tradeBlocs: ['AfCFTA', 'AU', 'IGAD'], currency: 'ETB', incomeGroup: 'low',
    dependencies: ['Coffee price', 'Chinese infrastructure loans', 'Nile dam geopolitics'],
  },
  {
    iso2: 'GH', name: 'Ghana',
    topExportPartners: [{ country: 'India', pct: 12.5 }, { country: 'China', pct: 10.5 }, { country: 'Switzerland', pct: 10.5 }, { country: 'UAE', pct: 8.5 }],
    topImportPartners: [{ country: 'China', pct: 22.5 }, { country: 'United States', pct: 6.5 }, { country: 'UK', pct: 5.5 }],
    topExports: [{ product: 'Gold', pct: 42.5 }, { product: 'Crude petroleum', pct: 18.5 }, { product: 'Cocoa', pct: 12.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 8.5 }, { product: 'Vehicles', pct: 5.5 }, { product: 'Rice', pct: 3.5 }],
    tradeBalance: -4, tradeToGDP: 68, currentAccount: -3.0,
    tradeBlocs: ['AfCFTA', 'ECOWAS', 'WTO'], currency: 'GHS', incomeGroup: 'lower-middle',
    dependencies: ['Gold/cocoa/oil prices', 'IMF program', 'Debt restructuring'],
  },
  {
    iso2: 'UA', name: 'Ukraine',
    topExportPartners: [{ country: 'Poland', pct: 12.5 }, { country: 'Romania', pct: 8.5 }, { country: 'Turkey', pct: 6.5 }, { country: 'China', pct: 5.5 }],
    topImportPartners: [{ country: 'China', pct: 15.5 }, { country: 'Poland', pct: 12.5 }, { country: 'Germany', pct: 8.5 }],
    topExports: [{ product: 'Grain/cereals', pct: 22.5 }, { product: 'Iron/steel', pct: 15.5 }, { product: 'Sunflower oil', pct: 8.5 }],
    topImports: [{ product: 'Refined petroleum', pct: 12.5 }, { product: 'Machinery', pct: 8.5 }, { product: 'Military equipment', pct: 6.5 }],
    tradeBalance: -22, tradeToGDP: 80, currentAccount: -5.5,
    tradeBlocs: ['WTO', 'EU Association'], currency: 'UAH', incomeGroup: 'lower-middle',
    dependencies: ['War economy', 'Western military/financial aid', 'Black Sea grain corridor', 'Energy infrastructure'],
  },
]

// ── Lookup by ISO2 ──────────────────────────────────────────────────────────
const PROFILE_MAP = new Map(TRADE_PROFILES.map(p => [p.iso2, p]))

// Name-based lookup
const NAME_TO_ISO2: Record<string, string> = {}
for (const p of TRADE_PROFILES) {
  NAME_TO_ISO2[p.name.toLowerCase()] = p.iso2
}
// Common aliases
Object.assign(NAME_TO_ISO2, {
  'usa': 'US', 'united states of america': 'US', 'america': 'US',
  'uk': 'GB', 'england': 'GB', 'britain': 'GB', 'great britain': 'GB',
  'south korea': 'KR', 's.korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR',
  'uae': 'AE', 'emirates': 'AE', 'united arab emirates': 'AE',
  's.africa': 'ZA', 'south africa': 'ZA',
  'holland': 'NL', 'the netherlands': 'NL',
  'ivory coast': 'CI',
  'czech republic': 'CZ', 'czechia': 'CZ',
  'myanmar': 'MM', 'burma': 'MM',
})

export function getTradeProfile(countryName: string): TradeProfile | null {
  const lc = countryName.toLowerCase().trim()
  // Direct name match
  const iso = NAME_TO_ISO2[lc]
  if (iso) return PROFILE_MAP.get(iso) ?? null
  // ISO2 match
  if (/^[A-Z]{2}$/.test(countryName)) return PROFILE_MAP.get(countryName) ?? null
  // Partial match — blank/very short input would otherwise be a substring of every name
  if (lc.length < 3) return null
  for (const [name, code] of Object.entries(NAME_TO_ISO2)) {
    if (lc.includes(name) || name.includes(lc)) return PROFILE_MAP.get(code) ?? null
  }
  return null
}
