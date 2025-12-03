import type { VoiceOption } from '../../state/types';

// Voice definition helper
function v(fullValue: string, gender: 'male' | 'female'): VoiceOption {
  const [locale, name] = fullValue.split(', ');
  return { locale, name, fullValue, gender };
}

export const voices: VoiceOption[] = [
  // Multilingual
  v('en-AU, WilliamMultilingualNeural', 'male'),
  v('en-US, AndrewMultilingualNeural', 'male'),
  v('en-US, AvaMultilingualNeural', 'female'),
  v('en-US, BrianMultilingualNeural', 'male'),
  v('en-US, EmmaMultilingualNeural', 'female'),
  v('fr-FR, VivienneMultilingualNeural', 'female'),
  v('fr-FR, RemyMultilingualNeural', 'male'),
  v('de-DE, SeraphinaMultilingualNeural', 'female'),
  v('de-DE, FlorianMultilingualNeural', 'male'),
  v('it-IT, GiuseppeMultilingualNeural', 'male'),
  v('ko-KR, HyunsuMultilingualNeural', 'male'),
  v('pt-BR, ThalitaMultilingualNeural', 'female'),
  // English
  v('en-IN, NeerjaExpressiveNeural', 'female'),
  v('en-US, ChristopherNeural', 'male'),
  v('en-US, JennyNeural', 'female'),
  v('en-GB, RyanNeural', 'male'),
  v('en-GB, SoniaNeural', 'female'),
  v('en-GB, LibbyNeural', 'female'),
];

export default voices;
