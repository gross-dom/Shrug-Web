// The portfolio, grouped by vertical, as listed on the design canvas.

export interface Vertical {
  name: string
  companies: string[]
}

export const VERTICALS: Vertical[] = [
  { name: 'Deep tech', companies: ['Hadrian', 'Varda', 'Senra', 'Antares', 'Enigma', 'Anduril', 'Merlin Labs', 'Galvanick', 'AMCA'] },
  { name: 'Climate and energy', companies: ['Avalanche Energy', 'Earth', 'Living Carbon', 'Mona Lee Solar'] },
  { name: 'Creator', companies: ['Khloud', 'W Labs', 'Night', 'Feastables', 'Rob’s Popcorn', 'Homemade', 'Tone', 'BloxSnacks', 'Fourthwall'] },
  { name: 'Health', companies: ['Eight Sleep', 'Nucleus', 'Summer Health', 'Loyal', 'Levels'] },
  { name: 'Consumer', companies: ['ModRetro', 'Supergreat', 'Genies', 'Pogo', 'Snackpass', 'Primer', 'Superplastic', 'Liquid Death', 'Hype & Vice', 'Montes', 'Light Phone', 'Drumroll', 'Cameo'] },
  { name: 'Fintech', companies: ['Lula', 'MainStreet', 'Seis', 'Aidaly', 'Copilot', 'Runway', 'Pipe'] },
  { name: 'Web3', companies: ['RTFKT', 'MoonPay', 'OnCyber', 'Thirdweb', 'Crossmint', 'Once Upon', 'Layer2', 'Hang'] },
  { name: 'Marketplaces', companies: ['Alt', 'Seso', 'Acquire', 'Ghost', 'Snappr', 'AdQuick', 'The Network', 'Bezel', 'Seated'] },
  { name: 'AI', companies: ['Diagram', 'Mem.ai', 'PlaygroundAI', 'DoNotPay', 'Voiceflow', 'Betterleap', 'Sauron', 'Superhuman', 'Outtake', 'Tome'] },
  { name: 'Products', companies: ['Atoms', 'Opal', 'Carrd', 'Canal', 'Sundays', 'Luminai', 'Sandbox VR', 'Giraffe360', 'Shinkei', 'Kapwing', 'Cabal'] },
  { name: 'Enterprise', companies: ['Charthop', 'Aether'] },
  { name: 'Social', companies: ['Clubhouse', 'Poparazzi', 'HQ Trivia', 'Popshop', 'Freestyle Chess', 'Dispo'] },
  { name: 'Other', companies: ['818', 'Memora Health', 'Overtime', 'Blank Street'] },
]

export const COMPANY_COUNT = VERTICALS.reduce((n, v) => n + v.companies.length, 0)
