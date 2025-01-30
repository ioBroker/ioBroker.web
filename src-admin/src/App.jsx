import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { AppBar, Tabs, Tab } from '@mui/material';

import { I18n, Loader, AdminConnection, GenericApp } from '@iobroker/adapter-react-v5';

import Options from './Tabs/Options';
import Certificates from './Tabs/Certificates';
import WhiteList from './Tabs/WhiteList';
import Background from './Tabs/Background';
import Additionally from './Tabs/Additionally';
import UserList from './Tabs/UserList';
import Toast from './Components/Toast';

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

const styles = {
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
    selected: theme => ({
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    }),
    indicator: theme => ({
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    }),
};

const arrayTabName = [
    {
        name: 'options',
        translate: 'main_settings',
        index: 0,
    },
    {
        name: 'certificates',
        translate: 'certificates',
        index: 1,
    },
    {
        name: 'whiteList',
        translate: 'whiteList',
        index: 2,
    },
    {
        name: 'userList',
        translate: 'UserList',
        index: 3,
    },
    {
        name: 'additionally',
        translate: 'additionally',
        index: 4,
    },
    {
        name: 'background',
        translate: 'background',
        index: 5,
    },
];

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
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

    getSelectedTab() {
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

    onPrepareSave(settings) {
        super.onPrepareSave(settings);
        const { secure, certPublic, certPrivate } = this.state.native;

        if (secure && (!certPrivate || !certPublic)) {
            this.setState({ toast: 'set_certificates' });
            return false;
        }
        return true;
    }

    renderTab() {
        const { native } = this.state;
        let selectedTab = this.state.selectedTab;
        if (this.checkDisabledTabs(this.state.selectedTab)) {
            selectedTab = 'options';
        }

        switch (selectedTab) {
            case 'certificates':
                return (
                    <Certificates
                        key="certificates"
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        adapterName={this.adapterName}
                    />
                );

            case 'whiteList':
                return (
                    <WhiteList
                        key="whiteList"
                        theme={this.state.theme}
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        adapterName={this.adapterName}
                    />
                );

            case 'userList':
                return (
                    <UserList
                        key="userList"
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        adapterName={this.adapterName}
                    />
                );

            case 'additionally':
                return (
                    <Additionally
                        key="additionally"
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        adapterName={this.adapterName}
                    />
                );

            case 'background':
                return (
                    <Background
                        key="background"
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        adapterName={this.adapterName}
                    />
                );
            case 'options':
            default:
                return (
                    <Options
                        key="options"
                        themeType={this.state.themeType}
                        common={this.common}
                        socket={this.socket}
                        native={native}
                        onError={text =>
                            this.setState({
                                errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text,
                            })
                        }
                        instance={this.instance}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        adapterName={this.adapterName}
                        onLoad={_native => this.setState({ native: _native })}
                    />
                );
        }
    }

    checkDisabledTabs(nameTab) {
        const { native } = this.state;
        return (
            (!native.auth && nameTab === 'background') ||
            (!native.secure && nameTab === 'certificates') ||
            (!native.auth && (nameTab === 'whiteList' || nameTab === 'userList'))
        );
    }

    render() {
        const { loaded, theme, themeType, toast } = this.state;
        if (!loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader theme={themeType} />
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
