import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../constants/Appsettings';

export interface AppConfig {
  appLogo: string;
  appDescription: string;
  apiUrl: string;
  signalrUrl: string;
  appName: string;
  version: string;
  taxInclusive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

    constructor(private http: HttpClient) {}

    async loadConfig(): Promise<void> {
    try {
        console.log('Loading config...');
        const config = await firstValueFrom(
        this.http.get<AppConfig>('assets/config.json')
        );

        AppSettings.apiUrl = config.apiUrl;
        AppSettings.signalrUrl = config.signalrUrl;
        AppSettings.appName = config.appName;
        AppSettings.version = config.version;
        AppSettings.appDescription = config.appDescription;
        AppSettings.appLogo = config.appLogo;
        AppSettings.taxInclusive = config.taxInclusive ?? true;
        AppSettings.apiUrl = config.apiUrl;
        console.log('Config loaded', AppSettings.apiUrl);

    } catch (error) {
        console.error('Failed to load config.json', error);
        throw error;
    }
    }
}