import type { AsmrSection, Voice, InitData } from '@/@types';
import type { AsmrAdditionalChapter } from './gameDataResolver';

const PAY_MONEY = 4; // pay.typeが課金（pay.data.num=円・goods_idあり）。5=無料、1=報酬/アイテム解放(numは個数で円ではない)

/** 円表示できる価格。課金タイプのみ（報酬/アイテム解放のnumは円ではないためnull） */
export const asmrPriceYen = (section: AsmrSection): number | null =>
  section.pay.type === PAY_MONEY && section.pay.data.num > 0 ? section.pay.data.num : null;

/** 開放済み（＝チャプター情報が取れる）セクションID。所持 ∪ 取り込み分 ∪ 無料 */
export const enabledAsmrSectionIds = (
  voice: Voice | undefined,
  initData: InitData | undefined,
  additionalChapters: ReadonlyArray<AsmrAdditionalChapter>,
): Set<string> =>
  new Set(
    (initData?.result.player_data.voice ?? []).concat(additionalChapters.map((x) => x.section_id)).concat(
      Object.values(voice?.all.section ?? {})
        .filter((v) => v.pay.data.num === 0)
        .map((v) => v.section_id),
    ),
  );
