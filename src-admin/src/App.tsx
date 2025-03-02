import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { AppBar, Tabs, Tab } from '@mui/material';

import { I18n, Loader, AdminConnection, GenericApp, type IobTheme } from '@iobroker/adapter-react-v5';

import Options from './Tabs/Options';
import IpFilterList from './Tabs/IpFilterList';
import Background from './Tabs/Background';
import Additionally from './Tabs/Additionally';
import UserList from './Tabs/UserList';
import { Toast } from './Components/Toast';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhCnLang from './i18n/zh-cn.json';
import type { GenericAppProps, GenericAppSettings, GenericAppState } from '@iobroker/adapter-react-v5/build/types';
import type { WebAdapterConfig } from './types';

const styles: Record<string, any> = {
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto',
    },
    selected: (theme: IobTheme): React.CSSProperties => ({
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    }),
    indicator: (theme: IobTheme): React.CSSProperties => ({
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    }),
};

type TabName = 'options' | 'ipFilter' | 'userList' | 'additionally' | 'background';

const arrayTabName: {
    name: TabName;
    translate: string;
    index: number;
}[] = [
    {
        name: 'options',
        translate: 'main_settings',
        index: 0,
    },
    {
        name: 'ipFilter',
        translate: 'whiteList',
        index: 1,
    },
    {
        name: 'userList',
        translate: 'UserList',
        index: 2,
    },
    {
        name: 'additionally',
        translate: 'additionally',
        index: 3,
    },
    {
        name: 'background',
        translate: 'background',
        index: 4,
    },
];

interface AppState extends GenericAppState {
    selectedTab: TabName;
    native: WebAdapterConfig;
    loaded: boolean;
    themeType: 'light' | 'dark';
    theme: IobTheme;
    toast: string;
}

class App extends GenericApp<GenericAppProps, AppState> {
    constructor(props: object) {
        const extendedProps: GenericAppSettings = { ...props };
        extendedProps.encryptedFields = ['pass'];
        // @ts-expect-error fix later
        extendedProps.Connection = AdminConnection;
        extendedProps.translations = {
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhCnLang,
        };
        extendedProps.sentryDSN = window.sentryDSN;
        super(props, extendedProps);
    }

    getSelectedTab(): number {
        const { selectedTab } = this.state;
        const tab = selectedTab;
        if (tab) {
            if (this.checkDisabledTabs(tab)) {
                return 0;
            }
            return arrayTabName.find(el => el.name === tab)?.index || 0;
        }

        return 0;
    }

    onPrepareSave(settings: WebAdapterConfig): boolean {
        super.onPrepareSave(settings);
        const { secure, certPublic, certPrivate } = this.state.native;

        if (secure && (!certPrivate || !certPublic)) {
            this.setState({ toast: 'set_certificates' });
            return false;
        }
        return true;
    }

    renderTab(): React.JSX.Element {
        const { native } = this.state;
        let selectedTab = this.state.selectedTab;
        if (this.checkDisabledTabs(this.state.selectedTab)) {
            selectedTab = 'options';
        }

        switch (selectedTab) {
            case 'ipFilter':
                return (
                    <IpFilterList
                        key="whiteList"
                        theme={this.state.theme}
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        themeType={this.state.themeType}
                    />
                );

            case 'userList':
                return (
                    <UserList
                        key="userList"
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    />
                );

            case 'additionally':
                return (
                    <Additionally
                        key="additionally"
                        native={native}
                        onChange={(attr: string | boolean, value?: any, cb?: () => void): void =>
                            this.updateNativeValue(attr as string, value, cb)
                        }
                    />
                );

            case 'background':
                return (
                    <Background
                        key="background"
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        instance={this.instance}
                    />
                );
            case 'options':
            default:
                return (
                    <Options
                        key="options"
                        themeType={this.state.themeType}
                        common={this.common!}
                        socket={this.socket}
                        native={native}
                        instance={this.instance}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        onLoad={(native: WebAdapterConfig): void => this.setState({ native })}
                        lang={I18n.getLanguage()}
                    />
                );
        }
    }

    checkDisabledTabs(nameTab: TabName): boolean {
        const { native } = this.state;
        return (
            (!native.auth && nameTab === 'background') ||
            (!native.auth && (nameTab === 'ipFilter' || nameTab === 'userList'))
        );
    }

    render(): React.JSX.Element {
        const { loaded, theme, themeType, toast } = this.state;
        if (!loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader themeType={themeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Toast
                        message={toast}
                        onClose={() => this.setState({ toast: '' })}
                    />
                    <div
                        className="App"
                        style={{ background: theme.palette.background.default, color: theme.palette.text.primary }}
                    >
                        <AppBar position="static">
                            <Tabs
                                value={this.getSelectedTab()}
                                onChange={(e, index) =>
                                    this.selectTab(
                                        arrayTabName.find(el => el.index === index)?.name || arrayTabName[0].name,
                                        index,
                                    )
                                }
                                scrollButtons="auto"
                                sx={{ '& .MuiTabs-indicator': styles.indicator }}
                            >
                                {arrayTabName.map((el, index) => (
                                    <Tab
                                        key={`${index}-tab-key`}
                                        sx={{ '& .MuiTab-selected': styles.selected }}
                                        disabled={this.checkDisabledTabs(el.name)}
                                        label={I18n.t(el.translate)}
                                        data-name={el.name}
                                    />
                                ))}
                            </Tabs>
                        </AppBar>
                        <div style={this.isIFrame ? styles.tabContentIFrame : styles.tabContent}>
                            {this.renderTab()}
                        </div>
                        {this.renderError()}
                        {this.renderSaveCloseButtons()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default App;
