import { Text } from 'preact-i18n';
import { MarkdownView } from './MarkdownView';

export function AboutView() {
  return <MarkdownView file="about.md" title="About Edge TTS" />;
}
