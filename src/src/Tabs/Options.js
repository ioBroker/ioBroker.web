import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import Security from '@material-ui/icons/Security';

import Logo from '@iobroker/adapter-react/Components/Logo';
import I18n from '@iobroker/adapter-react/i18n';

import Toast from '../Components/Toast';
import CustomModal from '../Components/CustomModal';
import CustomSelect from '../Components/CustomSelect';
import CustomInput from '../Components/CustomInput';
import CustomCheckbox from '../Components/CustomCheckbox';
import {LinearProgress} from "@material-ui/core";

const styles = theme => ({
    blockWrapper: {
        display: 'flex',
        flexDirection: 'column',
        marginRight: 20,
        '@media screen and (max-width: 360px)': {
            marginRight: 0
        }
    },
    displayNone: {
        display: 'none !important'
    },
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 10px)',
    },
    blockWrapperCheckbox: {
        display: 'flex',
        flexFlow: 'wrap'
    },
    ipInputStyle: {
        marginTop: 10,
        width: 900,
        marginRight: 20,
        '@media screen and (max-width: 940px)': {
            width: '100%'
        }
    },
    blockWarning: {
        background: '#2196f3',
        color: '#fff',
        margin: '20px 2px',
        padding: 8,
        fontSize: 20
    },
    blockWarningContent: {
        flexFlow: 'wrap',
        display: 'flex',
        alignItems: 'flex-end'
    }
});

class Options extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toast: '',
            ipAddressOptions: [],
            certificatesOptions: [],
            usersOptions: [],
            socketioOptions: [
                { title: I18n.t('nothing'), value: 'none' },
                { title: I18n.t('built_in'), value: '' }
            ],
            openModal: false,
            loaded: 0,
        };
    }

    componentDidMount() {
        const { instance, socket, common: { host } } = this.props;
        const { socketioOptions } = this.state;
        let loaded = 0;
        socket.getAdapterInstances('socketio').then(state => {
            this.setState({ loaded: ++loaded, socketioOptions: [...socketioOptions, ...state.map(({ _id, common: { name } }) => ({ title: `${name} [${name}.${instance}]`, value: _id }))] })
        });

        socket.getRawSocket().emit('getHostByIp', host, (err, data) => {
            if (data) {
                let IPs4 = [{ title: `[IPv4] 0.0.0.0 - ${I18n.t('open_ip')}`, value: '0.0.0.0', family: 'ipv4' }];
                let IPs6 = [{ title: '[IPv6] ::', value: '::', family: 'ipv6' }];
                if (data.native.hardware && data.native.hardware.networkInterfaces) {
                    for (let eth in data.native.hardware.networkInterfaces) {
                        if (!data.native.hardware.networkInterfaces.hasOwnProperty(eth)) {
                            continue;
                        }
                        for (let num = 0; num < data.native.hardware.networkInterfaces[eth].length; num++) {
                            if (data.native.hardware.networkInterfaces[eth][num].family !== 'IPv6') {
                                IPs4.push({ title: `[${data.native.hardware.networkInterfaces[eth][num].family}] ${data.native.hardware.networkInterfaces[eth][num].address} - ${eth}`, value: data.native.hardware.networkInterfaces[eth][num].address, family: 'ipv4' });
                            } else {
                                IPs6.push({ title: `[${data.native.hardware.networkInterfaces[eth][num].family}] ${data.native.hardware.networkInterfaces[eth][num].address} - ${eth}`, value: data.native.hardware.networkInterfaces[eth][num].address, family: 'ipv6' });
                            }
                        }
                    }
                }
                for (let i = 0; i < IPs6.length; i++) {
                    IPs4.push(IPs6[i]);
                }
                this.setState({ loaded: ++loaded, ipAddressOptions: IPs4 });
            }
        })

        socket.getCertificates()
            .then(list =>
                this.setState({ loaded: ++loaded,certificatesOptions: list }));

        socket.getUsers()
            .then(list =>
                this.setState({ loaded: ++loaded, usersOptions: list }));
    }

    componentDidUpdate(prevProps) {
        const { native: { auth, secure } } = prevProps;
        const { native: { defaultUser, whiteListSettings }, onChange } = this.props;
        if (!this.props.native.auth && (auth !== this.props.native.auth)) {
            onChange('whiteListSettings.default.user', defaultUser);
        } else if (whiteListSettings && whiteListSettings.default.user !== 'auth' && (auth !== this.props.native.auth)) {
            onChange('whiteListSettings.default.user', 'auth');
        }
        if (defaultUser !== prevProps.native.defaultUser) {
            onChange('whiteListSettings.default.user', defaultUser);
        }
        if (!this.props.native.secure && this.props.native.auth && !this.state.openModal && ((auth !== this.props.native.auth) || (secure !== this.props.native.secure))) {
            this.setState({ openModal: true });
        }
    }

    render() {
        const { instance, common, classes, native, onLoad, onChange } = this.props;
        const { certificatesOptions, ipAddressOptions, usersOptions, openModal, toast, socketioOptions, loaded } = this.state;

        if (loaded < 4) {
            return <LinearProgress />;
        }

        let newCommon = JSON.parse(JSON.stringify(common));
        newCommon.icon = newCommon.extIcon;

        return <form className={classes.tab}>
            <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
            <CustomModal
                open={openModal}
                buttonClick={() => {
                    onChange('auth', false);
                    this.setState({ openModal: !openModal });
                    this.setState({ toast: 'Authentication_deactivated' });
                }}
                close={() => this.setState({ openModal: !openModal })}
                titleButton={I18n.t('button_title')}
                titleButton2={I18n.t('button_title2')}>
                <div className={classes.blockWarningContent}><Security style={{ width: 32, height: 32 }} />{I18n.t('modal_title')}</div>
            </CustomModal>
            <Logo
                instance={instance}
                classes={undefined}
                common={newCommon}
                native={native}
                onError={text => this.setState({ errorText: text })}
                onLoad={onLoad}
            />
            <div className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomSelect
                        title='IP address'
                        attr='bind'
                        noTranslate
                        className={classes.ipInputStyle}
                        options={ipAddressOptions}
                        native={native}
                        onChange={onChange}
                    />
                    <CustomInput
                        title='port'
                        attr='port'
                        type='number'
                        style={{ marginTop: 5 }}
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div className={classes.blockWrapperCheckbox}>
                    <div className={classes.blockWrapper}>
                        <CustomCheckbox
                            title='encryption'
                            attr='secure'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomCheckbox
                            title='authentication'
                            attr='auth'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomCheckbox
                            className={native['auth'] ? null : classes.displayNone}
                            title='basic_authentication'
                            attr='basicAuth'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomCheckbox
                            title='cache'
                            attr='cache'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomSelect
                            title='socket'
                            attr='socketio'
                            noTranslate
                            options={socketioOptions}
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                    <div className={classes.blockWrapper}>
                        <div className={`${classes.blockWrapperCheckbox} ${native['secure'] ? null : classes.displayNone}`} >
                            <CustomSelect
                                title='public_certificate'
                                attr='certPublic'
                                noTranslate
                                options={[
                                    { title: I18n.t('nothing'), value: '' },
                                    ...certificatesOptions.filter(({ type }) => !type || type === 'public').map(({ name }) => ({ title: name, value: name }))
                                ]}
                                style={{ marginTop: 10, marginRight: 20 }}
                                native={native}
                                onChange={onChange}
                            />
                            <CustomSelect
                                title='private_certificate'
                                attr='certPrivate'
                                noTranslate
                                options={[
                                    { title: I18n.t('nothing'), value: '' },
                                    ...certificatesOptions.filter(({ type }) => !type || type === 'private').map(({ name }) => ({ title: name, value: name }))
                                ]}
                                style={{ marginTop: 10, marginRight: 20 }}
                                native={native}
                                onChange={onChange}
                            />
                            <CustomSelect
                                title='chained_certificate'
                                attr='certChained'
                                noTranslate
                                options={[
                                    { title: I18n.t('nothing'), value: '' },
                                    ...certificatesOptions.filter(({ type }) => !type || type === 'chained').map(({ name }) => ({ title: name, value: name }))
                                ]}
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={onChange}
                            />
                        </div>
                        <CustomSelect
                            className={!native['auth'] ? null : classes.displayNone}
                            title='users'
                            attr='defaultUser'
                            themeType={this.props.themeType}
                            noTranslate
                            options={usersOptions.map(({ _id, common: { name, color, icon } }) => ({
                                title: typeof name === 'object' ? name[this.props.lang] || name.end || _id.replace(/^system\.user\./, '') : name,
                                value: _id.replace(/^system\.user\./, ''),
                                color,
                                icon
                            }))}
                            style={{ marginTop: 10, width: 300 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomInput
                            className={native['auth'] ? null : classes.displayNone}
                            title='time_out'
                            attr='ttl'
                            type='number'
                            style={{ marginTop: -1, width: 300 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomCheckbox
                            title='simple_api'
                            attr='simpleapi'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomCheckbox
                            className={native['socketio'] === '' ? null : classes.displayNone}
                            title='web_sockets'
                            attr='forceWebSockets'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                </div>
            </div>
        </form>;
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    changed: PropTypes.bool,
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
};

export default withStyles(styles)(Options);