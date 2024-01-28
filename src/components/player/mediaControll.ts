export type Media = {
  name: string;
  buffer: AudioBuffer;
};

export const onTimeUpdate = (ev: Event) => {
  const target = ev.target as HTMLMediaElement;
  if (target.currentTime < target.duration - Number(target.getAttribute('cut-end'))) return;
  target.currentTime = Number(target.getAttribute('cut-start'));
  const repeat = target.getAttribute('repeat');
  if (repeat === 'true') target.play();
  if (repeat === 'false') {
    target.pause();
    target.dispatchEvent(new Event('ended'));
  }
};
export const onEnd = (ev: Event) => {
  const target = ev.target as HTMLMediaElement;
  target.currentTime = Number(target.getAttribute('cut-start'));
  if (target.getAttribute('repeat') === 'true') target.play();
};

export const playMedia = (media: Media) => {
  (document.getElementById(media.name) as HTMLMediaElement).play();
};
export const pauseMedia = (media: Media) => {
  (document.getElementById(media.name) as HTMLMediaElement).pause();
};
