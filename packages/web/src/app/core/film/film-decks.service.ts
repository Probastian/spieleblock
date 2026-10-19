import { Injectable, computed, inject } from '@angular/core';
import { hitster } from '@spieleblock/games';
import { ENDPOINTS, FILM_LISTS, isFilmList, type FilmsResponse } from '@spieleblock/shared';
import { ApiHttp } from '../api/http.service';
import { AppInfo } from '../api/app-info.service';
import { Store } from '../state/store.service';
import { BUILTIN_FILMS } from './film-builtin';

type Options = hitster.HitsterOptions;

export const BUILTIN_LIST = 'eingebaut';

export interface FilmListInfo {
  id: string;
  name: string;
  blurb: string;
  /** Kommt von TMDB (braucht den Zugang auf dem Server). */
  online: boolean;
}

/** Filmlisten für den Film-Zeitstrahl: die mitgelieferte Liste und, wenn der Server einen TMDB-Zugang hat, weitere. */
@Injectable({ providedIn: 'root' })
export class FilmDecks {
  private readonly store = inject(Store);
  private readonly http = inject(ApiHttp);
  private readonly info = inject(AppInfo);

  readonly options = computed(() => this.store.options<Options>('film'));
  readonly online = computed(() => this.info.tmdb());
  readonly lists = computed<FilmListInfo[]>(() => [
    { id: BUILTIN_LIST, name: 'Bekannte Filme', blurb: `${BUILTIN_FILMS.length} Filme, läuft ohne Netz`, online: false },
    ...(this.online() ? FILM_LISTS.map(l => ({ id: l.id as string, name: l.name, blurb: l.blurb, online: true })) : []),
  ]);

  constructor() {
    void this.info.load();
  }

  select(id: string): void {
    const list = this.lists().find(l => l.id === id);
    this.store.setGameOptions<Options>('film', { source: list ? { id: list.id, name: list.name } : null });
  }

  /** Karten einer Liste; Jahre, die von Hand korrigiert wurden, gelten vor allem anderen. */
  async load(listId: string): Promise<hitster.HitsterCard[]> {
    const years = this.options().years;
    let cards: hitster.HitsterCard[];
    if (listId === BUILTIN_LIST || !isFilmList(listId)) {
      cards = BUILTIN_FILMS.map(c => ({ ...c }));
    } else {
      const res = await this.http.request<FilmsResponse>('GET', `${ENDPOINTS.films}?list=${encodeURIComponent(listId)}`, undefined, 40_000);
      cards = res.films.map(f => ({ id: `m${f.id}`, title: f.title, artist: f.original, year: f.year, ...(f.poster ? { cover: f.poster } : {}) }));
    }
    return cards.map(c => (years[c.id]?.src === 'user' ? { ...c, year: years[c.id]!.y } : c));
  }

  /** Trägt ein Jahr von Hand ein; es gilt ab sofort in allen Filmspielen. */
  setUserYear(id: string, year: number): void {
    this.store.updateMeta(m => {
      const o = m.settings.games['film'] as Options;
      o.years = hitster.normalizeYears({ ...o.years, [id]: { y: year, src: 'user' } });
    });
  }

  errorText(e: unknown): string {
    return this.online() ? 'Die Filmliste konnte nicht geladen werden. Versuch es später nochmal oder wähle „Bekannte Filme“.' : 'Das hat nicht geklappt.';
  }
}
