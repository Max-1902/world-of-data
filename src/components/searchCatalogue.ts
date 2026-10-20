import type { PanelGroup } from '../panels/types'
import { GROUP_ORDER, GROUP_SECTIONS, panelsForGroup } from '../panels/registry'
import { LAYER_IDS, VIEW_MODES } from './layerCatalogue'
import { CHOKEPOINTS } from '../services/chokepoints'
import type { PaletteItem } from '../utils/paletteSearch'

/**
 * Words people type for a panel that its title doesn't contain. Search-only aliases; they never appear in the UI.
 * Keyed by registry id — an id that no longer exists is simply ignored (and flagged by searchCatalogue.test.ts).
 */
export const PANEL_ALIASES: Record<string, string> = {
  analyst: 'ai analyst assistant chat chatbot llm model ask question claude gpt openrouter',
  predictions: 'prediction forecast forecasts forecasting projection future outlook gdp inflation unemployment backtest',
  threat: 'risk tension global index score',
  risk: 'risk countries ranking',
  intel: 'incidents events conflict acled',
  crisiswatch: 'crisis icg conflict tracker',
  watchlist: 'watch follow alerts trends',
  markets: 'stocks etf indices prices',
  inventories: 'eia oil crude gas stockpiles energy',
  gasForecast: 'natural gas storage forecast injection withdrawal eia weekly bcf backtest prediction',
  economy: 'gdp world bank macro',
  owid: 'trends our world in data',
  countryAnalytics: 'correlation compare indicators scatter',
  analytics: 'earthquakes wildfires hazards hex',
  countryLookup: 'country profile lookup',
  militaryPersonnel: 'army troops military personnel',
  military: 'bases military',
  nuclear: 'reactors weapons',
  disasters: 'gdacs earthquake cyclone flood',
  outages: 'internet ioda cloudflare radar outages shutdown',
  humanitarian: 'refugees unhcr displacement',
  infraIndicators: 'electricity power energy',
  news: 'news headlines signals',
  brief: 'briefing summary news',
  livefeed: 'tv video broadcast live',
  webcams: 'cameras webcam',
  layers: 'layers overlays map',
}

/** Searchable catalogue: every registry panel (with its workspace + section as extra keywords), layers, map styles, chokepoints. */
export function buildSearchCatalogue(): { catalogue: PaletteItem[]; groupOfPanel: Map<string, PanelGroup> } {
  const groupOfPanel = new Map<string, PanelGroup>()
  const catalogue: PaletteItem[] = []
  for (const g of GROUP_ORDER) {
    for (const p of panelsForGroup(g.id)) {
      groupOfPanel.set(p.id, g.id)
      const section = GROUP_SECTIONS[g.id]?.find(s => s.id === p.section)?.title ?? ''
      catalogue.push({ id: `panel:${p.id}`, kind: 'panel', label: p.title, hint: p.desc, keywords: `${g.label} ${section} ${PANEL_ALIASES[p.id] ?? ''}` })
    }
  }
  for (const l of LAYER_IDS) catalogue.push({ id: `layer:${l.id}`, kind: 'layer', label: l.label, hint: l.desc })
  for (const v of VIEW_MODES) catalogue.push({ id: `view:${v.id}`, kind: 'view', label: v.label })
  for (const c of CHOKEPOINTS) catalogue.push({ id: `choke:${c.name}`, kind: 'chokepoint', label: c.name, hint: c.controlledBy })
  return { catalogue, groupOfPanel }
}

export const GROUP_LABEL: Record<string, string> = Object.fromEntries(GROUP_ORDER.map(g => [g.id, g.label]))
