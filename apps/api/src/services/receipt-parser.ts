import { isCalendarDate } from '../utils/validation'

const keywords: Record<string, string[]> = {
  'Food & drink': [
    'supermarket', 'restaurant', 'cafe', 'coffee', 'bakery', 'bar', 'food',
    'lawson', 'familymart', '7-eleven', 'seven', 'starbucks', 'mcdonald',
    'まいばすけっと', 'レストラン', 'カフェ', 'ファミリーマート', 'セブン',
    'ローソン', 'スタバ', 'マクドナルド', '居酒屋', '食堂', '弁当', '寿司',
    'スーパー', 'パン', '焼肉', 'ラーメン', '珈琲',
  ],
  Transport: [
    'suica', 'pasmo', 'icoca', 'metro', 'subway', 'transit', 'bus', 'taxi',
    'uber', 'grab', 'train', 'gas', 'gasoline', 'parking',
    '電車', 'タクシー', '交通', '切符', 'ガソリン', '定期券', '駐車場',
  ],
  Shopping: [
    'amazon', 'rakuten', 'uniqlo', 'zara', 'muji', 'daiso', 'seria',
    'bic camera', 'yodobashi', 'don quijote', 'apple', 'store',
    'ユニクロ', '無印', 'ダイソー', 'セリア', 'ドンキ', 'ビックカメラ',
    'ヨドバシ', '書店', '本屋', '百貨店', 'ショップ',
  ],
  Health: [
    'pharmacy', 'clinic', 'hospital', 'drug', 'medicine', 'dental',
    'matsukiyo', 'welcia', '薬局', 'ドラッグ', '病院', 'クリニック',
    'マツキヨ', 'ウエルシア', '医院', '歯科', '処方',
  ],
  Entertainment: [
    'cinema', 'movie', 'netflix', 'spotify', 'theater', 'karaoke', 'game',
    'toho', '映画', 'カラオケ', '劇場', 'コンサート',
  ],
  Bills: [
    'electric', 'electricity', 'internet', 'tepco', 'gas', 'water',
    'utility', 'phone', 'docomo', 'softbank', 'au', 'ntt',
    '電気', '水道', 'ガス', '通信', '光熱費', '電話',
  ],
}

// Common headers on receipts that are not store names
const HEADER_IGNORE_REGEX = /^(?:receipt|tax\s+invoice|invoice|sales\s+slip|領収書|領収証|レシート|買上票|お買上票|no\.?|tel\.?|電話|date|日時|http|www\.)/i

function cleanCjkSpaces(text: string): string {
  // Remove spaces between consecutive CJK characters (Tesseract Japanese often inserts spaces)
  return text.replace(/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])/g, '$1$2')
}

export function normalizeAmountsInText(text: string): string {
  let s = text.normalize('NFKC').replace(/\\/g, '¥')
  // Fix spaces between digits and thousands separators: "2 , 700" or "2, 700" -> "2,700"
  s = s.replace(/(\d)\s*,\s*(\d{2,3})\b/g, '$1,$2')
  // In Japanese yen receipts, dots between 3-digit groupings like "¥2.700" are misread commas
  s = s.replace(/(¥\s*\d{1,3})\s*\.\s*(\d{3})(?!\d)/g, '$1,$2')
  s = s.replace(/(\d{1,3})\s*\.\s*(\d{3})(?!\d)(?=\s*円)/g, '$1,$2')
  // Fix spaces after currency symbols: "¥ 2,700" or "¥ 2 , 700" -> "¥2,700"
  s = s.replace(/([¥$€₹])\s*(\d)/g, '$1$2')
  return s
}

function amountOnLine(line: string): number | null {
  const normalized = normalizeAmountsInText(line)
  // Grouped thousands (including Indian grouping), or an ungrouped decimal.
  const matches = [...normalized.matchAll(/-?\d[\d,.]*/g)]
  if (!matches.length) return null
  const token = matches[matches.length - 1][0]
  if (!/^(?:\d+|\d{1,3}(?:,\d{2,3})*,\d{3})(?:\.\d{1,2})?$/.test(token)) return null
  const value = Number(token.replace(/,/g, ''))
  return Number.isFinite(value) && value > 0 && value <= 9999999999.99 ? value : null
}

export function parseReceipt(text: string) {
  const rawCleaned = cleanCjkSpaces(text.normalize('NFKC').replace(/\\/g, '¥'))
  const lines = rawCleaned
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  const normalized = lines.join('\n')
  const warnings: string[] = []

  // ── 1. AMOUNT DETECTION ──────────────────────────────────────────
  let amount: number | null = null

  // Total line patterns (Japanese and English)
  const isTotalKeyword = (l: string) =>
    /(?:grand\s+total|amount\s+due|balance\s+due|net\s+amount|total\s+amount|\btotal\b|合\s*計|お買上(?:げ)?\s*(?:額|合計)?|支払(?:い)?\s*合計|税込(?:\s*合計)?|\b計\b|会\s*計|お\s*会計|で\s*at|(?:\bat\b.*[¥$€])|credit\s+card|カード\s*支払)/i.test(l)

  const isExcludedKeyword = (l: string) =>
    /sub\s*total|小計|税抜|消費税|内消費税|tax|change|お釣|釣銭|現計|お預[か]?[り]?|cash|tendered|point|ポイント/i.test(l)

  const totalLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isExcludedKeyword(line) && isTotalKeyword(line))

  for (const { line, index } of totalLines) {
    const candidate = amountOnLine(line) ?? (lines[index + 1] ? amountOnLine(lines[index + 1]) : null)
    if (candidate !== null) {
      amount = candidate
      break
    }
  }

  // Fallback: If line immediately following "小計" (subtotal) has an amount, that line is typically "合計"
  if (amount === null) {
    const subtotalIdx = lines.findIndex(l => /小計|sub\s*total/i.test(l))
    if (subtotalIdx !== -1 && lines[subtotalIdx + 1]) {
      const nextAmt = amountOnLine(lines[subtotalIdx + 1])
      if (nextAmt !== null) {
        amount = nextAmt
      }
    }
  }

  if (amount === null) {
    warnings.push('No reliable total found. Enter the amount manually.')
  }

  // ── 2. MERCHANT NAME DETECTION ───────────────────────────────────
  let name: string | null = null

  // Priority 1: Check if any known brand keyword appears in the first 8 lines
  const lowerAll = normalized.toLowerCase()
  for (const categoryKeywords of Object.values(keywords)) {
    for (const kw of categoryKeywords) {
      if (kw.length >= 3 && lowerAll.includes(kw.toLowerCase())) {
        // Find line containing this keyword
        const matchingLine = lines.slice(0, 8).find(l => l.toLowerCase().includes(kw.toLowerCase()))
        if (matchingLine) {
          name = matchingLine.replace(HEADER_IGNORE_REGEX, '').trim()
          break
        }
      }
    }
    if (name) break
  }

  // Priority 2: Use the first non-header, non-date, non-empty line
  if (!name) {
    for (const line of lines.slice(0, 6)) {
      if (HEADER_IGNORE_REGEX.test(line)) continue
      if (/^\d{4}[-/年]/.test(line)) continue // skip pure date lines
      if (/^tel|電話|fax/i.test(line)) continue
      const cleanedLine = line.replace(/^[#*•\-\s]+/, '').trim()
      if (cleanedLine.length >= 2) {
        name = cleanedLine.slice(0, 100)
        break
      }
    }
  }

  if (!name && lines.length > 0) {
    name = lines[0].slice(0, 100)
  }

  // ── 3. DATE DETECTION ────────────────────────────────────────────
  let entryDate: string | null = null
  const ymd = normalized.match(/\b(\d{4})\s*[\/\-年.:]\s*(\d{1,2})\s*[\/\-月.:]\s*(\d{1,2})\s*(?:日|\b)/)
  const dmy = normalized.match(/\b(\d{1,2})\s*[\/\-.:]\s*(\d{1,2})\s*[\/\-.:]\s*(\d{4})\b/)

  if (ymd) {
    entryDate = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  } else if (dmy) {
    if (Number(dmy[1]) <= 12 && Number(dmy[2]) <= 12 && dmy[1] !== dmy[2]) {
      warnings.push('Ambiguous receipt date. Enter it manually.')
    } else {
      entryDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    }
  }

  if (entryDate && !isCalendarDate(entryDate)) {
    entryDate = null
    warnings.push('Receipt date is invalid.')
  }

  if (entryDate) {
    const yr = Number(entryDate.slice(0, 4))
    const currentYear = new Date().getFullYear()
    if (yr > currentYear + 1 || yr < 2000) {
      // OCR misread (e.g. 2925 for 202x)
      const candidateYear = `20${entryDate.slice(2, 4)}`
      const candidateYrNum = Number(candidateYear)
      if (candidateYrNum >= 2000 && candidateYrNum <= currentYear + 1 && isCalendarDate(`${candidateYear}${entryDate.slice(4)}`)) {
        entryDate = `${candidateYear}${entryDate.slice(4)}`
      } else {
        const fallback = `${currentYear}${entryDate.slice(4)}`
        if (isCalendarDate(fallback)) {
          entryDate = fallback
        } else {
          entryDate = null
          warnings.push('Receipt date is invalid.')
        }
      }
    }
  }

  // ── 4. TIME DETECTION ────────────────────────────────────────────
  // Exclude times that immediately follow a 4-digit year like 2026:10:06
  const timeMatches = [...normalized.matchAll(/(?<!\d{4}[:.-])\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\b/gi)]
  let entryTime: string | null = null
  for (const time of timeMatches) {
    let hour = Number(time[1])
    const minute = Number(time[2])
    const validHour = time[3] ? hour >= 1 && hour <= 12 : hour <= 23
    if (validHour && minute <= 59) {
      if (time[3]) hour = (hour % 12) + (time[3].toUpperCase() === 'PM' ? 12 : 0)
      entryTime = `${String(hour).padStart(2, '0')}:${time[2]}`
      break
    }
  }

  // ── 5. CATEGORY SUGGESTION ───────────────────────────────────────
  const lower = normalized.toLowerCase()
  const suggestedCategory =
    Object.entries(keywords).find(([, words]) => words.some(word => lower.includes(word.toLowerCase())))?.[0] ?? null

  return {
    name: name ? name.trim() : null,
    amount,
    entryDate,
    entryTime,
    suggestedCategory,
    requiresReview: true,
    warnings,
    categoryMethod: 'keyword-heuristic' as const,
    rawText: normalized,
  }
}