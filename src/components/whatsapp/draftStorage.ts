import { FlowType, AssistantDraft } from "./types";

export function createDraftStorageKey(shopId: string, senderPhone: string): string {
  return `restockr_assistant_draft_${shopId}_${senderPhone.replace(/\+/g, "")}`;
}

export function clearAssistantDraft(shopId: string, senderPhone: string): void {
  try {
    const key = createDraftStorageKey(shopId, senderPhone);
    localStorage.removeItem(key);
    localStorage.removeItem(`restockr_assistant_draft_${shopId}`);
  } catch (e) {
    console.warn("Assistant draft clear failed", e);
  }
}

export function saveAssistantDraft(
  shopId: string,
  senderPhone: string,
  flow: FlowType,
  step: number,
  data: any,
  images: string[],
  video: string
): void {
  if (flow === "none" || step === 0) {
    clearAssistantDraft(shopId, senderPhone);
    return;
  }
  try {
    const key = createDraftStorageKey(shopId, senderPhone);
    localStorage.setItem(key, JSON.stringify({
      flow,
      step,
      data,
      uploadedImages: images,
      uploadedVideo: video,
      senderPhone,
      completed: false,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn("Assistant draft save failed", e);
  }
}

export function getAssistantDraft(shopId: string, senderPhone: string): AssistantDraft | null {
  try {
    const key = createDraftStorageKey(shopId, senderPhone);
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (!parsed || parsed.flow === "none" || parsed.step <= 0 || parsed.completed) {
      clearAssistantDraft(shopId, senderPhone);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
