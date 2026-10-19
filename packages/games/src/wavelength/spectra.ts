/** Gegensatz-Paare für Wavelength: links ↔ rechts. */
export type Spectrum = readonly [left: string, right: string];

const pairs = (text: string): Spectrum[] =>
  text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.split('|').map(s => s.trim()) as unknown as Spectrum);

export const SPECTRA: readonly Spectrum[] = pairs(`
kalt | heiß
schlecht | gut
langweilig | aufregend
billig | teuer
klein | groß
leise | laut
altmodisch | modern
unwichtig | wichtig
hässlich | schön
weich | hart
ungesund | gesund
gefährlich | sicher
Fremdschämen | Stolz
Guilty Pleasure | Kulturgut
unterschätzt | überschätzt
eklig | lecker
peinlich | cool
Sommer | Winter
Anfänger | Profi
einfach | kompliziert
Glück | Können
Hund | Katze
Tag | Nacht
chaotisch | ordentlich
langsam | schnell
alltäglich | außergewöhnlich
Spaß | Arbeit
Fastfood | Sterneküche
Kindergeburtstag | Beerdigung
harmlos | unverzeihlich
Berg | Meer
dünn | dick
spießig | rebellisch
nutzlos | unverzichtbar
Hobby | Beruf
schwer | leicht
sauber | dreckig
rund | eckig
jung | alt
Stadt | Land
leise Musik | Krach
Vorspeise | Nachtisch
Frühaufsteher | Nachteule
Held | Bösewicht
Zufall | Schicksal
zu kurz | zu lang
brav | frech
trocken | feucht
dunkel | hell
bitter | süß
Mist | Meisterwerk
unromantisch | romantisch
nüchtern | betrunken
harmlose Lüge | fieser Betrug
selten | häufig
Verlierer | Gewinner
Anfang | Ende
verboten | erlaubt
privat | öffentlich
Gebrauchsgegenstand | Kunstwerk
Fernsehen | Kino
Sparfuchs | Verschwender
müde | wach
unfreundlich | freundlich
Rentner | Baby
Dorf | Metropole
kurzer Spaziergang | Weltreise
Mathe | Kunst
Kopf | Bauch
Erfinder | Entdecker
Teamsport | Einzelsport
vegetarisch | Fleischfresser
zum Weinen | zum Lachen
Pech | Glück
vernünftig | verrückt
aus der Mode | trendy
unbekannt | berühmt
gruselig | niedlich
Kleinigkeit | Katastrophe
Frühstück | Abendessen
Plastik | Holz
Kaffee | Tee
schlechter Film | Meisterwerk
gute Idee | schlechte Idee
Luxus | Notwendigkeit
Pflicht | Kür
Gespräch | Streit
Sofa | Fitnessstudio
Urlaub | Alltag
Bargeld | Karte
Hausmittel | Medizin
Brettspiel | Videospiel
Lieblingslied | Ohrwurm, den man hasst
Kompliment | Beleidigung
freiwillig | Zwang
seriös | albern
Chef | Angestellter
leichte Beute | harte Nuss
gut verstecken | gut finden
Sonnenaufgang | Sonnenuntergang
Stolperfalle | Sicherheitsnetz
`);
