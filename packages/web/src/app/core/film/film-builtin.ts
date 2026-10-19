import type { hitster } from '@spieleblock/games';

/** Bekannte Filme mit Erscheinungsjahr (Kinostart im Ursprungsland). Läuft ohne Netz und ohne TMDB-Zugang. */
const RAW = `
Metropolis|1927
Der blaue Engel|1930
M – Eine Stadt sucht einen Mörder|1931
King Kong und die weiße Frau|1933
Vom Winde verweht|1939
Der Zauberer von Oz|1939
Citizen Kane|1941
Casablanca|1942
Ist das Leben nicht schön?|1946
Der dritte Mann|1949
Du sollst mein Glücksstern sein|1952
Das Fenster zum Hof|1954
Manche mögen’s heiß|1959
Ben Hur|1959
Psycho|1960
Frühstück bei Tiffany|1961
West Side Story|1961
Lawrence von Arabien|1962
Dr. Seltsam|1964
Mary Poppins|1964
Goldfinger|1964
Meine Lieder, meine Träume|1965
Doktor Schiwago|1965
Die Reifeprüfung|1967
Spiel mir das Lied vom Tod|1968
2001: Odyssee im Weltraum|1968
Planet der Affen|1968
Easy Rider|1969
Butch Cassidy und Sundance Kid|1969
Uhrwerk Orange|1971
Der Pate|1972
Cabaret|1972
Der Exorzist|1973
Der Clou|1973
Chinatown|1974
Der weiße Hai|1975
Einer flog über das Kuckucksnest|1975
Taxi Driver|1976
Rocky|1976
Krieg der Sterne|1977
Unheimliche Begegnung der dritten Art|1977
Saturday Night Fever|1977
Grease|1978
Halloween|1978
Superman|1978
Das Leben des Brian|1979
Alien|1979
Apocalypse Now|1979
Mad Max|1979
Die Blechtrommel|1979
Das Imperium schlägt zurück|1980
Shining|1980
Blues Brothers|1980
Flying High|1980
Jäger des verlorenen Schatzes|1981
Das Boot|1981
E.T. – Der Außerirdische|1982
Blade Runner|1982
Tootsie|1982
Scarface|1983
Die Rückkehr der Jedi-Ritter|1983
Footloose|1984
Ghostbusters|1984
Terminator|1984
Die unendliche Geschichte|1984
Zurück in die Zukunft|1985
Die Goonies|1985
Top Gun|1986
Aliens – Die Rückkehr|1986
Stand by Me|1986
Ferris macht blau|1986
Platoon|1986
Dirty Dancing|1987
Die Braut des Prinzen|1987
RoboCop|1987
Predator|1987
Wall Street|1987
Der Himmel über Berlin|1987
Rain Man|1988
Stirb langsam|1988
Falsches Spiel mit Roger Rabbit|1988
Die nackte Kanone|1988
Big|1988
Der Club der toten Dichter|1989
Harry und Sally|1989
Batman|1989
Indiana Jones und der letzte Kreuzzug|1989
Zurück in die Zukunft II|1989
Pretty Woman|1990
Kevin – Allein zu Haus|1990
Ghost – Nachricht von Sam|1990
Das Schweigen der Lämmer|1991
Terminator 2|1991
Die Schöne und das Biest|1991
Thelma & Louise|1991
Basic Instinct|1992
Aladdin|1992
Schtonk!|1992
Jurassic Park|1993
Schindlers Liste|1993
Mrs. Doubtfire|1993
Philadelphia|1993
Forrest Gump|1994
Pulp Fiction|1994
Der König der Löwen|1994
Die Verurteilten|1994
Léon – Der Profi|1994
Der bewegte Mann|1994
Die üblichen Verdächtigen|1995
Toy Story|1995
Braveheart|1995
Sieben|1995
Heat|1995
GoldenEye|1995
Mission: Impossible|1996
Independence Day|1996
Fargo|1996
Trainspotting|1996
Scream|1996
Titanic|1997
Men in Black|1997
Das fünfte Element|1997
Das Leben ist schön|1997
Good Will Hunting|1997
Knockin’ on Heaven’s Door|1997
Lola rennt|1998
Der Soldat James Ryan|1998
Shakespeare in Love|1998
Die Truman Show|1998
Matrix|1999
Fight Club|1999
American Beauty|1999
The Sixth Sense|1999
Blair Witch Project|1999
Notting Hill|1999
The Green Mile|1999
Toy Story 2|1999
Eyes Wide Shut|1999
Sonnenallee|1999
Gladiator|2000
Memento|2000
Erin Brockovich|2000
Shrek|2001
Harry Potter und der Stein der Weisen|2001
Der Herr der Ringe: Die Gefährten|2001
Moulin Rouge!|2001
Die fabelhafte Welt der Amélie|2001
Ocean’s Eleven|2001
Monsters AG|2001
Der Schuh des Manitu|2001
Ice Age|2002
Spider-Man|2002
Catch Me If You Can|2002
Chicago|2002
Der Pianist|2002
Gangs of New York|2002
Findet Nemo|2003
Fluch der Karibik|2003
Der Herr der Ringe: Die Rückkehr des Königs|2003
Lost in Translation|2003
Kill Bill – Volume 1|2003
Mystic River|2003
Good Bye, Lenin!|2003
Das Wunder von Bern|2003
Der Untergang|2004
Troja|2004
Die Unglaublichen|2004
Vergiss mein nicht!|2004
Million Dollar Baby|2004
(T)Raumschiff Surprise – Periode 1|2004
Sin City|2005
Batman Begins|2005
Brokeback Mountain|2005
Krieg der Welten|2005
King Kong|2005
Madagascar|2005
Casino Royale|2006
Departed – Unter Feinden|2006
Little Miss Sunshine|2006
Borat|2006
300|2006
Das Leben der Anderen|2006
Das Parfum|2006
Ratatouille|2007
Juno|2007
No Country for Old Men|2007
Transformers|2007
Into the Wild|2007
Keinohrhasen|2007
WALL·E|2008
The Dark Knight|2008
Iron Man|2008
Slumdog Millionär|2008
Mamma Mia!|2008
Twilight – Bis(s) zum Morgengrauen|2008
Die Welle|2008
Avatar – Aufbruch nach Pandora|2009
Inglourious Basterds|2009
Oben|2009
Hangover|2009
Zombieland|2009
Sherlock Holmes|2009
Wickie und die starken Männer|2009
Männerherzen|2009
Inception|2010
Toy Story 3|2010
Black Swan|2010
The Social Network|2010
The King’s Speech|2010
Rapunzel – Neu verföhnt|2010
Ich – Einfach unverbesserlich|2010
Drive|2011
Ziemlich beste Freunde|2011
The Artist|2011
Kokowääh|2011
Marvel’s The Avengers|2012
Skyfall|2012
Django Unchained|2012
Les Misérables|2012
Argo|2012
Life of Pi|2012
Der Hobbit: Eine unerwartete Reise|2012
Oh Boy|2012
Gravity|2013
Die Eiskönigin – Völlig unverfroren|2013
Dallas Buyers Club|2013
12 Years a Slave|2013
The Wolf of Wall Street|2013
Fack ju Göhte|2013
Guardians of the Galaxy|2014
Interstellar|2014
Birdman|2014
The Grand Budapest Hotel|2014
Whiplash|2014
Honig im Kopf|2014
Mad Max: Fury Road|2015
Der Marsianer|2015
Star Wars: Das Erwachen der Macht|2015
Spotlight|2015
Alles steht Kopf|2015
Minions|2015
The Revenant|2015
Deadpool|2016
La La Land|2016
Zoomania|2016
Arrival|2016
Moonlight|2016
Vaiana|2016
Toni Erdmann|2016
Dunkirk|2017
Get Out|2017
Coco|2017
Shape of Water|2017
Thor: Tag der Entscheidung|2017
Black Panther|2018
Avengers: Infinity War|2018
A Star Is Born|2018
Bohemian Rhapsody|2018
Green Book|2018
Roma|2018
Joker|2019
Parasite|2019
Avengers: Endgame|2019
Once Upon a Time in Hollywood|2019
1917|2019
Knives Out|2019
Die Eiskönigin 2|2019
Toy Story 4|2019
Systemsprenger|2019
Tenet|2020
Nomadland|2020
Soul|2020
Dune|2021
Keine Zeit zu sterben|2021
Spider-Man: No Way Home|2021
Encanto|2021
Top Gun: Maverick|2022
Avatar: The Way of Water|2022
Everything Everywhere All at Once|2022
Im Westen nichts Neues|2022
Barbie|2023
Oppenheimer|2023
Wonka|2023
Inside Out 2|2024
Dune: Part Two|2024
Deadpool & Wolverine|2024
Wicked|2024
`;

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Die mitgelieferten Filme als Karten (ohne Plakat). Die ID hängt am Titel, damit Jahreskorrekturen erhalten bleiben. */
export const BUILTIN_FILMS: readonly hitster.HitsterCard[] = RAW.split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => {
    const [title, year] = l.split('|') as [string, string];
    return { id: `f-${slug(title)}-${year}`, title, artist: '', year: +year };
  });
