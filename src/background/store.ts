import * as browser from 'webextension-polyfill';
import { AllStories, BattleEvent, Characters, Enemy, InitData, Radio, Voice } from '@/@types';

//
let token: string | undefined = undefined;
let initData: InitData | undefined = undefined;
let stories!: AllStories | undefined;
let characters: Characters | undefined;
let enemies: Enemy | undefined;
let voices: Set<Voice> | undefined;
let battleEvent: BattleEvent | undefined;
let radio: Radio | undefined;

export const handleMessage = (message: any) => {
  switch (message.type) {
    case "setToken": return token = message.data;
    case "getToken": return token;
    case "setInitData": return initData = message.data;
    case "getInitData": return initData;
    case "setStories": return stories = message.data;
    case "getStories": return stories;
    case "setCharacters": return characters = message.data;
    case "getCharacters": return characters;
    case "setEnemy": return enemies = message.data;
    case "getEnemy": return enemies;
    case "setVoice": return voices = message.data;
    case "getVoice": return voices;
    case "setBattleEvent": return battleEvent = message.data;
    case "getBattleEvent": return battleEvent;
    case "setRadio": return radio = message.data;
    case "getRadio": return radio;
    default: return true;
  }
}

export const initStore = () => browser.runtime.onMessage.addListener(async (message, sender) => handleMessage(message));
