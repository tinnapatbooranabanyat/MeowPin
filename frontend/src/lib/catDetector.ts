import type { ObjectDetection } from '@tensorflow-models/coco-ssd'

// ผ่านเกณฑ์นี้ถือว่าเป็นแมว (ฝั่ง server จะตรวจซ้ำอีกรอบตอนต่อ backend)
export const CAT_THRESHOLD = 0.5

export interface CatDetection {
  isCat: boolean
  score: number
  bbox?: [number, number, number, number]
  /** สิ่งที่โมเดลเห็นชัดที่สุดถ้าไม่ใช่แมว เช่น dog, teddy bear */
  otherLabel?: string
}

let modelPromise: Promise<ObjectDetection> | null = null

/** โหลดโมเดลแบบ lazy — TF.js ใหญ่หลาย MB จึงแยก chunk และโหลดเฉพาะตอนจะเพิ่มแมว */
export function loadCatDetector(): Promise<ObjectDetection> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      await tf.ready()
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      return cocoSsd.load({ base: 'lite_mobilenet_v2' })
    })()
    modelPromise.catch(() => {
      modelPromise = null
    })
  }
  return modelPromise
}

export async function detectCat(img: HTMLImageElement): Promise<CatDetection> {
  const model = await loadCatDetector()
  const predictions = await model.detect(img, 20, 0.2)
  const cats = predictions.filter((p) => p.class === 'cat').sort((a, b) => b.score - a.score)
  const best = cats[0]
  if (best && best.score >= CAT_THRESHOLD) {
    return { isCat: true, score: best.score, bbox: best.bbox }
  }
  const other = predictions.filter((p) => p.class !== 'cat').sort((a, b) => b.score - a.score)[0]
  return { isCat: false, score: best?.score ?? 0, otherLabel: other?.class }
}

const OTHER_LABEL_MESSAGES: Record<string, string> = {
  dog: 'ดูเหมือนน้องหมานะ ไว้มีแอปปักหมุดหมาค่อยมาเจอกัน',
  'teddy bear': 'ตุ๊กตาไม่นับนะ ต้องเป็นแมวตัวจริง',
  person: 'เจอแต่คน ยังไม่เห็นแมวเลย',
  bird: 'นี่นกนะ ไม่ใช่แมว',
}

export function rejectionMessage(detection: CatDetection): string {
  if (detection.otherLabel && OTHER_LABEL_MESSAGES[detection.otherLabel]) {
    return OTHER_LABEL_MESSAGES[detection.otherLabel]
  }
  if (detection.score > 0.2) return 'ไม่แน่ใจว่าเป็นแมว ลองถ่ายให้ใกล้ขึ้นหรือเห็นหน้าน้องชัดๆ'
  return 'ไม่เจอแมวในรูปนี้ ลองถ่ายใหม่ให้เห็นน้องชัดๆ'
}
