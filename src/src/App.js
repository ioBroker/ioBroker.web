import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { AppBar, Tabs, Tab } from '@mui/material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';

import Options from './Tabs/Options';
import Certificates from './Tabs/Certificates';
import WhiteList from './Tabs/WhiteList';
import Background from './Tabs/Background';
import Additionally from './Tabs/Additionally';
import Toast from './Components/Toast';

const styles = theme => ({
    root: {},
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
    selected: {
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    },
    indicator: {
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    },
});

const arrayTabName = [
    {
        name: 'options',
        translate: 'main_settings',
        index: 0,
    },
    {
        name: 'certificates',
        translate: 'certificates',
        index: 1
    },
    {
        name: 'whiteList',
        translate: 'whiteList',
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

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
        extendedProps.Connection = AdminConnection;
        extendedProps.translations = {
            en: require('./i18n/en'),
            de: require('./i18n/de'),
            ru: require('./i18n/ru'),
            pt: require('./i18n/pt'),
            nl: require('./i18n/nl'),
            fr: require('./i18n/fr'),
            it: require('./i18n/it'),
            es: require('./i18n/es'),
            pl: require('./i18n/pl'),
            uk: require('./i18n/uk'),
            'zh-cn': require('./i18n/zh-cn'),
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
            } else {
                return arrayTabName.find((el) => el.name === tab)?.index || 0;
            }
        }

        return 0;
    }

    onPrepareSave(settings) {
        super.onPrepareSave(settings);
        const { secure, certPublic, certPrivate } = this.state.native;

        if (secure && (!certPrivate || !certPublic)) {
            this.setState({ toast: 'set_certificates' });
            return false;
        } else {
            return true;
        }
    }

    renderTab() {
        let { native } = this.state;
        let selectedTab = this.state.selectedTab;
        if (this.checkDisabledTabs(this.state.selectedTab)) {
            selectedTab = 'options';
        }

        switch (selectedTab) {
            case 'options':
            default:
                return <Options
                    key="options"
                    themeType={this.state.themeType}
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    adapterName={this.adapterName}
                    onLoad={native => this.setState({ native })}
                />;

            case 'certificates':
                return <Certificates
                    key="certificates"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    adapterName={this.adapterName}
                />;

            case 'whiteList':
                return <WhiteList
                    key="whiteList"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    adapterName={this.adapterName}
                />;

            case 'additionally':
                return <Additionally
                    key="additionally"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    adapterName={this.adapterName}
                />;

            case 'background':
                return <Background
                    key="background"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    adapterName={this.adapterName}
                />;
        }
    }

    checkDisabledTabs(nameTab) {
        const { native } = this.state;
        return (!native['auth'] && nameTab === 'background') ||
            (!native['secure'] && nameTab === 'certificates') ||
            (!native['auth'] && nameTab === 'whiteList');
    }

    render() {
        const { loaded, theme, themeType, toast } = this.state;
        const { classes } = this.props;
        if (!loaded) {
            return <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Loader theme={themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
                <div className="App" style={{ background: theme.palette.background.default, color: theme.palette.text.primary }}>
                    <AppBar position="static">
                        <Tabs
                            value={this.getSelectedTab()}
                            onChange={(e, index) =>
                                this.selectTab(arrayTabName.find(el => el.index === index)?.name || arrayTabName[0].name, index)}
                            scrollButtons="auto"
                            classes={{ indicator: this.props.classes.indicator }}
                        >
                            {arrayTabName.map((el, index) =>
                                <Tab
                                    key={`${index}-tab-key`}
                                    classes={{ selected: this.props.classes.selected }}
                                    disabled={this.checkDisabledTabs(el.name)}
                                    label={I18n.t(el.translate)}
                                    data-name={el.name}
                                />)}
                        </Tabs>
                    </AppBar>
                    <div className={this.isIFrame ? classes.tabContentIFrame : classes.tabContent}>
                        {this.renderTab()}
                    </div>
                    {this.renderError()}
                    {this.renderSaveCloseButtons()}
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
