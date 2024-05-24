// ストーリー
export type Story = {
  img: string;
  name: string;
  open?: { like: number }; // キャラだけ
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

// キャラクター
export type Character = {
  chara_id: string;
  title:string;
  name: string;
  kana: string;
  msg: { [index: string]: string };
  profile: unknown;
  order: number;
};
export type Characters = { chara_data: { [index: string]: Character } };

export type SpecificVoice = { chara_id: string; voice_id: string };

export type StoryElement = {
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
  p1_img_type: string;
  p1_img_id: string;
  p1_img_text: string;
  p1_img_pos: string;
  p1_img_pos_x: string;
  p1_img_pos_y: string;
  p1_chara_type: string;
  p1_chara_emotion: string;
  p1_chara_pos: string;
  p1_chara_size: string;
  p1_chara_direction: string;
  p1_chara_voice_text: string;
  p1_chara_voice_id: string;
  p1_chara_emoticon_id: string;
  p1_chara_emoticon_pos_x: string;
  p1_chara_emoticon_pos_y: string;
  p1_chara_motion_type: string;
  p1_chara_motion_times: string;
  p1_chara_slide_type: string;
  p1_chara_slide_direction: string;
  p1_effect_start: string;
  p1_effect_under1: string;
  p1_effect_under2: string;
  p1_sound_start: string;
  p2_img_type: string;
  p2_img_id: string;
  p2_img_text: string;
  p2_img_pos: string;
  p2_img_pos_x: string;
  p2_img_pos_y: string;
  p2_chara_type: string;
  p2_chara_emotion: string;
  p2_chara_pos: string;
  p2_chara_size: string;
  p2_chara_direction: string;
  p2_chara_voice_text: string;
  p2_chara_voice_id: string;
  p2_chara_emoticon_id: string;
  p2_chara_emoticon_pos_x: string;
  p2_chara_emoticon_pos_y: string;
  p2_chara_motion_type: string;
  p2_chara_motion_times: string;
  p2_chara_slide_type: string;
  p2_chara_slide_direction: string;
  p2_effect_start: string;
  p2_effect_under1: string;
  p2_effect_under2: string;
  p2_sound_start: string;
  p3_img_type: string;
  p3_img_id: string;
  p3_img_text: string;
  p3_img_pos: string;
  p3_img_pos_x: string;
  p3_img_pos_y: string;
  p3_chara_type: string;
  p3_chara_emotion: string;
  p3_chara_pos: string;
  p3_chara_size: string;
  p3_chara_direction: string;
  p3_chara_voice_text: string;
  p3_chara_voice_id: string;
  p3_chara_emoticon_id: string;
  p3_chara_emoticon_pos_x: string;
  p3_chara_emoticon_pos_y: string;
  p3_chara_motion_type: string;
  p3_chara_motion_times: string;
  p3_chara_slide_type: string;
  p3_chara_slide_direction: string;
  p3_effect_start: string;
  p3_effect_under1: string;
  p3_effect_under2: string;
  p3_sound_start: string;
  p4_img_type: string;
  p4_img_id: string;
  p4_img_text: string;
  p4_img_pos: string;
  p4_img_pos_x: string;
  p4_img_pos_y: string;
  p4_chara_type: string;
  p4_chara_emotion: string;
  p4_chara_pos: string;
  p4_chara_size: string;
  p4_chara_direction: string;
  p4_chara_voice_text: string;
  p4_chara_voice_id: string;
  p4_chara_emoticon_id: string;
  p4_chara_emoticon_pos_x: string;
  p4_chara_emoticon_pos_y: string;
  p4_chara_motion_type: string;
  p4_chara_motion_times: string;
  p4_chara_slide_type: string;
  p4_chara_slide_direction: string;
  p4_effect_start: string;
  p4_effect_under1: string;
  p4_effect_under2: string;
  p4_sound_start: string;
  p5_img_type: string;
  p5_img_id: string;
  p5_img_text: string;
  p5_img_pos: string;
  p5_img_pos_x: string;
  p5_img_pos_y: string;
  p5_chara_type: string;
  p5_chara_emotion: string;
  p5_chara_pos: string;
  p5_chara_size: string;
  p5_chara_direction: string;
  p5_chara_voice_text: string;
  p5_chara_voice_id: string;
  p5_chara_emoticon_id: string;
  p5_chara_emoticon_pos_x: string;
  p5_chara_emoticon_pos_y: string;
  p5_chara_motion_type: string;
  p5_chara_motion_times: string;
  p5_chara_slide_type: string;
  p5_chara_slide_direction: string;
  p5_effect_start: string;
  p5_effect_under2: string;
  p5_sound_start: string;
  movie_text: string;
};

// エネミー
export type Enemy = {
  [index: string]: {
    detail: string;
    img: string;
    name: string;
    section_id: string;
  };
};

export type InitData = {
  result: {
    player_data: {
      chara: {
        [index: string]: {
          chara_id: string;
          like_lv: number;
        };
      };
      story: {
        main: { [index: string]: number };
        event: { [index: string]: string };
        limited: { [index: string]: string };
        chara: { [index: string]: number };
      };
      voice: Array<string>;
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

// イベント
export type BattleEvent = {
  [index: string]: {
    dungeons: {
      [index: string]: {
        story_section: string;
      };
    };
    event_id: string;
  };
};

// ラジオ
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

// ASMR
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
