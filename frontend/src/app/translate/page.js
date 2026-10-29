import {T} from '@/components/LanguageProvider';
import TextTranslator from '@/components/TextTranslator';
import {pageMetadata} from '@/lib/site';

export const metadata=pageMetadata('Translate text','Translate text with our self-hosted Argos Translate backend. English and Hindi are free; more languages are available with Premium and installed models.','/translate');

export default function TranslatePage(){
 return <div className="container page-space translator-page"><p className="eyebrow"><T>LANGUAGE TOOLS</T></p><h1 className="page-title"><T>Translate text</T></h1><p className="page-subtitle"><T>Automatic translation, powered by Argos Translate.</T></p><TextTranslator/></div>;
}
