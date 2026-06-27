export type Story = {
  adult_type: number;
  img: string;
  name: string;
  open?: { like: number }; // キャラのみ
  order: number;
  st_id: number;
  chapter: string;
  details: string;
};
export type Stories = { [index: string]: Array<Story> };

export type Section = {
  chapter: string;
  name: string;
  order: number;
  section_id: string;
};
export type Sections = { [index: string]: Section };

export type AllStories = {
  main: { section: Sections; story: Stories };
  chara: { story: Stories };
  event: { section: Sections; story: Stories };
  limited: { section: Sections; story: Stories };
};

export type SpecificVoice = { chara_id: string; voice_id: string };

// p{n}_*スロットフィールドの語幹（n=1..5）
type StorySlotFieldName =
  | 'img_type'
  | 'img_id'
  | 'img_text'
  | 'img_pos'
  | 'img_pos_x'
  | 'img_pos_y'
  | 'chara_type'
  | 'chara_emotion'
  | 'chara_pos'
  | 'chara_size'
  | 'chara_direction'
  | 'chara_voice_text'
  | 'chara_voice_id'
  | 'chara_emoticon_id'
  | 'chara_emoticon_pos_x'
  | 'chara_emoticon_pos_y'
  | 'chara_motion_type'
  | 'chara_motion_times'
  | 'chara_slide_type'
  | 'chara_slide_direction'
  | 'effect_start'
  | 'effect_under1'
  | 'effect_under2'
  | 'sound_start';

type StorySlotFields = { [K in `p${1 | 2 | 3 | 4 | 5}_${StorySlotFieldName}`]: string };

export type StoryElement = StorySlotFields & {
  text: string;
  speaker: string;
  backlog_icon_id: string;
  choice_flg: string;
  choice1: string;
  choice1_size: string;
  choice2: string;
  choice2_size: string;
  choice3: string;
  choice3_size: string;
  text_size: string;
  text_info: string;
  balloon_type: string;
  balloon_tail_type: string;
  zoom: string;
  zoom_pos: string;
  bg_img_type: string;
  bg_img_id: string;
  bg_img_text: string;
  bg_motion_type: string;
  bg_motion_times: string;
  bg_effect_under1: string;
  bg_effect_under2: string;
  bg_sound_start: string;
  bg_bgm: string;
  bg_env_sound: string;
  movie_text: string;
  // speaker{1,2}_* は「ふる転」ストーリーのみ存在。発見キャラの本名解決に使う
  speaker1_id?: string;
  speaker1_name?: string;
  speaker2_id?: string;
  speaker2_name?: string;
};

export type Enemy = {
  [index: string]: {
    detail: string;
    img: string;
    name: string;
    section_id: string;
  };
};

export type GameSettings = {
  lv_max: number;
  chara_rank_max: number;
  [key: string]: unknown;
};

export type PlayerChara = {
  chara_id: string;
  lv: number;
  exp: number;
  rarity: number; // 現在レアリティ（覚醒後）
  overlap: number; // 天衣
  rank: number;
  stuff: number[];
  like_lv: number;
  like_exp: number;
  skill: { s1: number; s2: number; s3: number; s4: number };
  order: number;
};

export type InitData = {
  result: {
    settings: GameSettings;
    player_data: {
      chara: { [index: string]: PlayerChara };
      story: {
        main: { [index: string]: number };
        event: { [index: string]: string };
        limited: { [index: string]: string };
        chara: { [index: string]: number };
      };
      voice: Array<string>;
      items_awake?: { [charaId: string]: number }; // 聖典（覚醒素材）の所持数
    };
    resources: {
      chara: string;
      items: string;
      story: string;
      enemy_section: string;
      battle_event: string;
      radio: string;
    };
  };
};

// 聖典(type=5)は周回報酬としてawake（メイン/旧イベント）かreward[]のtype5（限定リバイバル等）に入る。clear_rewardは初回ボーナスなので対象外
export type BattleReward = { id: string; num: number; type: number };
export type BattleAwake = BattleReward;
export type BattleStage = {
  name: string;
  awake?: BattleAwake;
  reward?: Array<BattleReward>;
  lv?: number;
  consume?: number;
};

// battleEvent: /game/res/battle_event
export type BattleEvent = {
  [index: string]: {
    dungeons: {
      [index: string]: {
        story_section: string;
      };
    };
    event_id: string;
    stages?: { [stageId: string]: BattleStage };
    rb_stages?: unknown;
  };
};

// ダンジョン（クエストを束ねる上位概念）
export type BattleDungeon = {
  name: string;
  data?: { normal?: { stages_list?: Array<string> }; hard?: { stages_list?: Array<string> } };
  limit?: { type?: number; start_time: number; end_time: number }; // 限定/外伝の開催期間
};

// battleMain: /game/res/battle_main
export type BattleMain = {
  stages: { [stageId: string]: BattleStage };
  dungeons?: { [dungeonId: string]: BattleDungeon };
};

// battleLimited: /game/res/battle_limited
export type BattleLimited = {
  [index: string]: {
    order: number;
    stages: { [stageId: string]: BattleStage };
    dungeons?: { [dungeonId: string]: BattleDungeon };
  };
};

// event: /game/res/event。キーはEVxxx（battleEventと対応）
export type EventInfo = {
  [eventId: string]: {
    name: string;
    start_time: number;
    end_time: number;
    change_time: number;
    event_id: string;
    chara_id1?: string;
    chara_id2?: string;
  };
};

export type Radio = {
  radio_guide: {
    [index: string]: {
      start: string;
      end: string;
      name: string;
      list: Array<string>;
    };
  };
};

export type Voice = {
  all: {
    chapter: {
      [index: string]: Array<AsmrChapter>;
    };
    section: {
      [index: string]: AsmrSection;
    };
  };
};

export type AsmrSection = {
  img: string;
  pay: {
    data: {
      id: string;
      num: number;
      type: number;
    };
    name: string;
    type: number;
    details: string;
  };
  name: string;
  limit: {
    type: number;
    end_time: number;
    start_time: number;
  };
  order: number;
  details: string;
  goods_id: number;
  sample_id: string;
  adult_type: number;
  section_id: string;
};

export type AsmrChapter = {
  name: string;
  ch_id: number;
  order: number;
};
