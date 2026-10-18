/** Wortlisten für Imposter, Wer bin ich und Stirnraten. Jede Kategorie hat eine feste ID (wird in Spielen gespeichert). */
export interface WordCategory {
  id: string;
  name: string;
  words: readonly string[];
}

const list = (text: string): string[] => text.split('|').map(w => w.trim()).filter(Boolean);

export const WORD_CATEGORIES: readonly WordCategory[] = [
  {
    id: 'essen',
    name: 'Essen & Trinken',
    words: list('Pizza|Spaghetti|Currywurst|Döner|Sushi|Pommes|Lasagne|Schnitzel|Pfannkuchen|Brezel|Sauerkraut|Gulasch|Burger|Käsespätzle|Eintopf|Bratwurst|Rührei|Müsli|Waffeln|Tiramisu|Apfelstrudel|Kartoffelsalat|Falafel|Croissant|Lebkuchen|Schokolade|Popcorn|Eiscreme|Spiegelei|Fischbrötchen|Leberkäse|Maultaschen|Cappuccino|Limonade|Glühwein|Radler|Bratkartoffeln|Nutella|Gummibärchen|Rotkohl'),
  },
  {
    id: 'tiere',
    name: 'Tiere',
    words: list('Elefant|Giraffe|Pinguin|Krokodil|Eichhörnchen|Delfin|Fledermaus|Känguru|Igel|Faultier|Papagei|Flamingo|Nilpferd|Hai|Seepferdchen|Wolf|Fuchs|Biber|Schildkröte|Chamäleon|Kolibri|Waschbär|Pfau|Qualle|Tintenfisch|Marienkäfer|Hamster|Eule|Ente|Luchs|Zebra|Gorilla|Koala|Otter|Schnecke|Maulwurf|Esel|Wildschwein|Specht|Seehund'),
  },
  {
    id: 'orte',
    name: 'Orte',
    words: list('Schwimmbad|Flughafen|Bibliothek|Kino|Zoo|Supermarkt|Bahnhof|Friedhof|Zirkus|Campingplatz|Bäckerei|Krankenhaus|Freizeitpark|Strand|Museum|Sauna|Tankstelle|Baumarkt|Kirche|Leuchtturm|Fußballstadion|Skihütte|Schloss|Weihnachtsmarkt|Waschanlage|Friseursalon|Spielplatz|Schule|Hotel|Bauernhof|Gefängnis|Rathaus|Dachboden|Keller|Kneipe|Disco|Werkstatt|Aufzug|Fähre|Zeltlager'),
  },
  {
    id: 'berufe',
    name: 'Berufe',
    words: list('Pilot|Feuerwehrmann|Zahnarzt|Bäcker|Detektiv|Astronaut|Friseur|Busfahrer|Lehrer|Pfarrer|Schornsteinfeger|Taucher|Zauberer|Clown|Metzger|Tierarzt|Richter|Koch|Briefträger|Archäologe|Kapitän|Gärtner|Fotograf|Maler|Müllmann|Bademeister|Sänger|Landwirt|Mechaniker|Schauspieler|Politiker|Schäfer|Hebamme|Journalist|Anwalt|Elektriker|Kellner|Tänzer|Bibliothekar|Förster'),
  },
  {
    id: 'dinge',
    name: 'Alltagsdinge',
    words: list('Regenschirm|Zahnbürste|Kühlschrank|Taschenlampe|Fernbedienung|Wecker|Staubsauger|Gießkanne|Schere|Hängematte|Kompass|Lupe|Kerze|Spiegel|Waschmaschine|Fahrrad|Rucksack|Sonnenbrille|Schlüssel|Geldbeutel|Handtuch|Luftballon|Toaster|Wasserkocher|Teppich|Hammer|Trampolin|Bügeleisen|Schnuller|Kopfhörer|Föhn|Sofa|Seifenblasen|Besen|Thermoskanne|Zollstock|Büroklammer|Reißverschluss|Gummistiefel|Feuerzeug'),
  },
  {
    id: 'sport',
    name: 'Sport & Freizeit',
    words: list('Fußball|Tennis|Golf|Boxen|Skispringen|Reiten|Segeln|Volleyball|Curling|Tischtennis|Handball|Bogenschießen|Surfen|Rugby|Eishockey|Basketball|Klettern|Biathlon|Fechten|Judo|Rudern|Darts|Bowling|Minigolf|Eiskunstlauf|Badminton|Kegeln|Marathon|Turnen|Snowboard|Skateboard|Paragliding|Baseball|Triathlon|Yoga|Angeln|Schach|Wandern|Tauchen|Karaoke'),
  },
  {
    id: 'film',
    name: 'Filme & Serien',
    words: list('Titanic|Shrek|Harry Potter|Der Herr der Ringe|Star Wars|Findet Nemo|Das Dschungelbuch|Jurassic Park|Matrix|Forrest Gump|Die Eiskönigin|Der König der Löwen|Pulp Fiction|Der Pate|Zurück in die Zukunft|Ghostbusters|E.T.|Kevin allein zu Haus|Fluch der Karibik|Avatar|Gladiator|Toy Story|Die Simpsons|Breaking Bad|Game of Thrones|Friends|Stranger Things|Tatort|Das Boot|Der Schuh des Manitu|Fack ju Göhte|Lola rennt|Good Bye, Lenin!|Biene Maja|Pippi Langstrumpf|Asterix und Obelix|Der Exorzist|Dirty Dancing|Mamma Mia|Terminator'),
  },
  {
    id: 'reise',
    name: 'Reiseziele',
    words: list('Paris|Rom|New York|Tokio|Venedig|Kairo|Sydney|Rio de Janeiro|Istanbul|Barcelona|Amsterdam|Wien|Prag|Island|Norwegen|Australien|Ägypten|Mallorca|Dubai|London|Hamburg|Berlin|München|Schweiz|Griechenland|Kanada|Mexiko|Indien|China|Italien|Spanien|Schottland|Hawaii|Alaska|Sahara|Nordpol|Bali|Kuba|Las Vegas|Neuseeland'),
  },
  {
    id: 'promis',
    name: 'Berühmte Personen',
    words: list('Albert Einstein|Angela Merkel|Michael Jackson|Elvis Presley|Marilyn Monroe|Leonardo da Vinci|Mozart|Beethoven|Napoleon|Cleopatra|William Shakespeare|Goethe|Pablo Picasso|Charlie Chaplin|Michael Schumacher|Cristiano Ronaldo|Lionel Messi|Boris Becker|Steffi Graf|Barack Obama|Donald Trump|Queen Elizabeth|Marie Curie|Mahatma Gandhi|Nelson Mandela|Muhammad Ali|Usain Bolt|Taylor Swift|Beyoncé|Helene Fischer|Udo Lindenberg|Thomas Gottschalk|Dieter Bohlen|Heidi Klum|Steve Jobs|Elon Musk|Bill Gates|Arnold Schwarzenegger|Tom Cruise|Brad Pitt|Leonardo DiCaprio|Johnny Depp|Til Schweiger|Papst Franziskus|Kolumbus|Mutter Teresa|Karl Marx|Sigmund Freud|Greta Thunberg|Neil Armstrong|Bob Marley|Freddie Mercury|David Bowie|Madonna|Rihanna|Lady Gaga|Oliver Kahn|Franz Beckenbauer|Loriot|Otto Waalkes'),
  },
  {
    id: 'figuren',
    name: 'Filmfiguren & Comics',
    words: list('Harry Potter|Darth Vader|Yoda|Shrek|Elsa|Simba|Dumbledore|Gandalf|Frodo|Jack Sparrow|James Bond|Batman|Superman|Spider-Man|Iron Man|Hulk|Thor|Homer Simpson|Bart Simpson|SpongeBob|Pikachu|Mickey Maus|Donald Duck|Bugs Bunny|Winnie Puuh|Biene Maja|Pippi Langstrumpf|Heidi|Rotkäppchen|Aschenputtel|Schneewittchen|Peter Pan|Pinocchio|Aladdin|Tarzan|Rapunzel|Woody|Buzz Lightyear|Nemo|Olaf|Super Mario|Lara Croft|Sherlock Holmes|Hermine Granger|Lord Voldemort|Gollum|Obelix|Asterix|Käpt’n Blaubär|Benjamin Blümchen|Bibi Blocksberg|Pumuckl|Tom und Jerry|Garfield|Snoopy|Pac-Man|Dagobert Duck|Der Grinch|Wall-E|Minion'),
  },
];

const byId = new Map(WORD_CATEGORIES.map(c => [c.id, c]));

export const wordCategory = (id: string): WordCategory | undefined => byId.get(id);

/** Kategorien für das Raten von Wörtern in Imposter (Dinge, Orte, Essen …). */
export const IMPOSTER_CATEGORIES: readonly string[] = ['essen', 'tiere', 'orte', 'berufe', 'dinge', 'sport', 'film', 'reise'];
/** Kategorien für „Wer bin ich“ am Tisch: Figuren, die man sein kann. */
export const FIGURE_CATEGORIES: readonly string[] = ['promis', 'figuren', 'tiere', 'berufe'];
/** Stirnraten: alle. */
export const HEADSUP_CATEGORIES: readonly string[] = WORD_CATEGORIES.map(c => c.id);

/** Nur bekannte Kategorie-IDs aus `allowed`, in der Reihenfolge von `allowed`. */
export function cleanCategoryIds(raw: unknown, allowed: readonly string[]): string[] {
  const set = new Set(Array.isArray(raw) ? raw.map(String) : []);
  return allowed.filter(id => set.has(id));
}
