import {Injectable, EventEmitter} from 'angular2/angular2';
import {Http, Response, Headers, Request} from 'angular2/http';
// doc: https://github.com/ReactiveX/RxJS/blob/master/doc/operator-creation.md
var Rx = require('@reactivex/rxjs/dist/cjs/Rx');

interface SFLoaderParams {
    prefix: string;
    suffix: string;
}

interface Observable {
    subscribe(next: Function, error: Function, dispose: Function);
    unsubscribe();
    toPromise(): Promise<any>;
}

interface TranslateLoader {
    onLanguageChange: EventEmitter;

    getTranslation(language: string): Observable;
}

@Injectable()
class TranslateStaticLoader implements TranslateLoader {
    private http: Http;
    public onLanguageChange: any;
    sfLoaderParams: SFLoaderParams = {prefix: 'i18n/', suffix: '.json'};

    constructor(http: Http) {
        this.http = http;

        this.onLanguageChange = new EventEmitter();
    }

    public useStaticFilesLoader(prefix: string, suffix: string) {
        this.sfLoaderParams.prefix = prefix;
        this.sfLoaderParams.suffix = suffix;
    }

    public getTranslation(language): Observable {
        return this.http.get(`${this.sfLoaderParams.prefix}/${language}${this.sfLoaderParams.suffix}`)
            .map((res: Response) => res.json());
    }
}

@Injectable()
export class TranslateService {
    private pending: any;
    private staticLoader: any;
    currentLanguage: string;
    defaultLanguage: string = 'en';
    translations: any = {};
    method: string = 'static';
    currentLoader: any;

    constructor(http: Http) {
        this.staticLoader = new TranslateStaticLoader(http);
        this.currentLoader = this.staticLoader;
    }

    setDefault(language: string) {
        this.defaultLanguage = language;
    }

    use(language: string): Observable {
        // check if this language is available
        if (typeof this.translations[language] === "undefined") {
            // not available, ask for it
            this.pending = this.getTranslation(language);

            this.pending.toPromise().then(() => {
                this.currentLanguage = language;
            });

            return this.pending;
        } else { // we have this language, return an observable
            this.currentLanguage = language;

            return Rx.Observable.create(observer => {
                observer.next();
                observer.complete();
            });
        }
    }

    getTranslation(language: string): Observable {
        var observable = this.currentLoader.getTranslation(language);

        observable.toPromise().then((res: Object) => {
            this.translations[language] = res;
            this.pending = undefined;
            if (this.currentLoader.onLanguageChange) {
                this.currentLoader.onLanguageChange.next(res);
            }
        });

        return observable;
    }

    get(key: string): Observable {
        // check if we are loading a new translation to use
        if (this.pending) {
            return Rx.Observable.create(observer => {
                this.pending.toPromise().then((res: any) => {
                    observer.next(res[key] || '');
                    observer.complete();
                });
            });
        } else {
            return Rx.Observable.create(observer => {
                observer.next(this.translations[this.currentLanguage][key] || key);
                observer.complete();
            });
        }
    }
}