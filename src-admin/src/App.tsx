import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { AppBar, Tabs, Tab, CssBaseline, Box } from '@mui/material';

import {
    I18n,
    Loader,
    AdminConnection,
    GenericApp,
    type IobTheme,
    ScrollbarStyles,
    type GenericAppProps,
    type GenericAppSettings,
    type GenericAppState,
} from '@iobroker/gui-components';

import Options from './Tabs/Options';
import IpFilterList from './Tabs/IpFilterList';
import Background from './Tabs/Background';
import Additionally from './Tabs/Additionally';
import UserList from './Tabs/UserList';
import CORS from './Tabs/CORS';
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
import type { WebAdapterConfig } from './types';

const styles: Record<string, any> = {
    app: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        // the save/close toolbar is positioned absolutely, it must be anchored on this container
        position: 'relative',
    },
    tabContent: {
        padding: 10,
        // take all the space between the tabs and the save toolbar
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'auto',
    },
    selected: (theme: IobTheme): React.CSSProperties => ({
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    }),
    indicator: (theme: IobTheme): React.CSSProperties => ({
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    }),
};

type TabName = 'options' | 'ipFilter' | 'userList' | 'additionally' | 'background' | 'CORS';

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
    {
        name: 'CORS',
        translate: 'CORS-settings',
        index: 5,
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
                        onChange={(attr: string, value: any, cb?: () => void) =>
                            this.updateNativeValue(attr, value, cb)
                        }
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
                        onChange={(attr: string, value: any, cb?: () => void) =>
                            this.updateNativeValue(attr, value, cb)
                        }
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
                        onChange={(attr: string | boolean, value?: any, cb?: () => void): void =>
                            this.updateNativeValue(attr as string, value, cb)
                        }
                        instance={this.instance}
                    />
                );
            case 'CORS':
                return (
                    <CORS
                        key="CORS"
                        native={native}
                        onChange={(attr: string, value: any, cb?: () => void) =>
                            this.updateNativeValue(attr, value, cb)
                        }
                    />
                );

            case 'options':
            default:
                return (
                    <Options
                        key="options"
                        themeType={this.state.themeType}
                        common={this.common || ({} as ioBroker.InstanceCommon)}
                        socket={this.socket}
                        native={native}
                        instance={this.instance}
                        onChange={(attr: string | boolean, value?: any, cb?: () => void): void =>
                            this.updateNativeValue(attr as string, value, cb)
                        }
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
        const { loaded, theme, themeType, toast, bottomButtons } = this.state;
        if (!loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <CssBaseline />
                        <Loader
                            themeType={themeType}
                            backgroundColor={theme.palette.background.default}
                        />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <ScrollbarStyles theme={this.state.theme} />
                    <Toast
                        message={toast}
                        onClose={() => this.setState({ toast: '' })}
                    />
                    <div
                        className="App"
                        style={{
                            ...styles.app,
                            background: theme.palette.background.default,
                            color: theme.palette.text.primary,
                        }}
                    >
                        <AppBar
                            position="static"
                            sx={{ flex: '0 0 auto' }}
                        >
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
                        <div style={styles.tabContent}>{this.renderTab()}</div>
                        {bottomButtons ? (
                            // Spacer for the absolutely positioned save/close toolbar, so the tab
                            // content can be scrolled completely. `mixins.toolbar` is the same
                            // height the toolbar itself uses. The 38px offset must use exactly the
                            // condition of `SaveCloseButtons`, which only shifts the toolbar up in
                            // the old admin (without `newReact`).
                            <Box
                                sx={theme => ({
                                    flex: '0 0 auto',
                                    ...theme.mixins.toolbar,
                                    marginBottom: !this.newReact && this.isIFrame ? '38px' : 0,
                                })}
                            />
                        ) : null}
                        {this.renderError()}
                        {this.renderSaveCloseButtons()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default App;
