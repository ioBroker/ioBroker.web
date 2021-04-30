import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import { MuiThemeProvider } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import GenericApp from '@iobroker/adapter-react/GenericApp';
import Loader from '@iobroker/adapter-react/Components/Loader'
import I18n from '@iobroker/adapter-react/i18n';
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
        overflow: 'auto'
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto'
    }
});

const arrayTabName = [{
    name: 'options',
    translate: 'main_settings',
    index: 0
}, {
    name: 'certificates',
    translate: 'certificates',
    index: 1
}, {
    name: 'whiteList',
    translate: 'whiteList',
    index: 2
}, {
    name: 'additionally',
    translate: 'additionally',
    index: 3
}, {
    name: 'background',
    translate: 'background',
    index: 4
}]

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
        extendedProps.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };
        super(props, extendedProps);
    }

    getSelectedTab() {
        const { selectedTab } = this.state;
        const tab = selectedTab;
        if (tab) {
            return arrayTabName.find((el) => el.name === tab)?.index || 0;
        } else {
            return 0;
        }
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
        const { selectedTab, native } = this.state;
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
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
                    adapterName={this.adapterName}
                />;

            case 'certificates':
                return <Certificates
                    key="certificates"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
                    adapterName={this.adapterName}
                />;

            case 'whiteList':
                return <WhiteList
                    key="whiteList"
                    common={this.common}
                    socket={this.socket}
                    native={native}
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
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
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
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
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
                    onError={text => this.setState({ errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text })}
                    instance={this.instance}
                    adapterName={this.adapterName}
                />;

        }
    }

    checkDisabledTabs(nameTab) {
        const { native } = this.state;
        return (!native['auth'] && nameTab === 'background') || (!native['secure'] && nameTab === 'certificates');
    }

    render() {
        const { loaded, theme, themeType, toast } = this.state;
        const { classes } = this.props;
        if (!loaded) {
            return <MuiThemeProvider theme={theme}>
                <Loader theme={themeType} />
            </MuiThemeProvider>;
        }

        return <MuiThemeProvider theme={theme}>
            <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
            <div className="App" style={{ background: theme.palette.background.default, color: theme.palette.text.primary }}>
                <AppBar position="static">
                    <Tabs value={this.getSelectedTab()} onChange={(e, index) => {
                        this.selectTab(arrayTabName.find((el) => el.index === index)?.name || arrayTabName[0].name, index)
                    }} scrollButtons="auto">
                        {arrayTabName.map((el, index) => (<Tab key={`${index}-tab-key`} disabled={this.checkDisabledTabs(el.name)} label={I18n.t(el.translate)} data-name={el.name} />))}
                    </Tabs>
                </AppBar>
                <div className={this.isIFrame ? classes.tabContentIFrame : classes.tabContent}>
                    {this.renderTab()}
                </div>
                {this.renderError()}
                {this.renderSaveCloseButtons()}
            </div>
        </MuiThemeProvider>;
    }
}

export default withStyles(styles)(App);
