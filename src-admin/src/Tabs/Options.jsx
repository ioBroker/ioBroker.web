import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';

import { Security } from '@mui/icons-material';

import { Logo, I18n } from '@iobroker/adapter-react-v5';

import Toast from '../Components/Toast';
import CustomModal from '../Components/CustomModal';
import CustomSelect from '../Components/CustomSelect';
import CustomInput from '../Components/CustomInput';
import CustomCheckbox from '../Components/CustomCheckbox';

const styles = {
    blockWrapper: {
        display: 'flex',
        flexDirection: 'column',
        mr: '20px',
        '@media screen and (max-width: 360px)': {
            mr: 0,
        },
    },
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20,
    },
    columnSettings: {
        width: 'calc(100% - 10px)',
    },
    blockWrapperCheckbox: {
        display: 'flex',
        flexFlow: 'wrap',
    },
    ipInputStyle: {
        mt: '10px',
        width: 600,
        mr: '20px',
        '@media screen and (max-width: 940px)': {
            width: '100%',
        },
    },
    blockWarning: {
        background: '#2196f3',
        color: '#fff',
        margin: '20px 2px',
        padding: 8,
        fontSize: 20,
    },
    blockWarningContent: {
        flexFlow: 'wrap',
        display: 'flex',
        alignItems: 'flex-end',
    },
};

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
                { title: I18n.t('built_in'), value: '_' },
            ],
            openModal: false,
            ready: false,
            confirmSocketIO: false,
        };
    }

    componentDidMount() {
        const {
            socket,
            common: { host },
        } = this.props;
        const { socketioOptions } = this.state;
        socket.getAdapterInstances('socketio').then(async state => {
            const wsInstances = await socket.getAdapterInstances('ws');
            if (wsInstances) {
                state = state.concat(wsInstances);
            }

            const newState = {
                ready: true,
                socketioOptions: [
                    ...socketioOptions,
                    ...state.map(({ _id, common: { name } }) => ({
                        title: `${name} [${name}.${_id.split('.').pop()}]`,
                        value: _id,
                    })),
                ],
            };
            const IPs4 = await socket.getHostByIp(host);
            IPs4.forEach(ip => {
                ip.title = ip.name;
                if (ip.title.includes('Listen on all IPs')) {
                    ip.title = ip.title.replace('Listen on all IPs', I18n.t('open_ip'));
                }
                ip.value = ip.address;
            });
            newState.ipAddressOptions = IPs4;

            newState.certificatesOptions = await socket.getCertificates();
            newState.usersOptions = await socket.getUsers();
            this.setState(newState);
        });
    }

    componentDidUpdate(prevProps) {
        const {
            native: { auth, secure },
        } = prevProps;
        const {
            native: { defaultUser, whiteListSettings },
            onChange,
        } = this.props;

        if (!this.props.native.auth && auth !== this.props.native.auth) {
            onChange('whiteListSettings.default.user', defaultUser);
        } else if (whiteListSettings && whiteListSettings.default.user !== 'auth' && auth !== this.props.native.auth) {
            onChange('whiteListSettings.default.user', 'auth');
        }
        if (defaultUser !== prevProps.native.defaultUser) {
            onChange('whiteListSettings.default.user', defaultUser);
        }
        if (
            !this.props.native.secure &&
            this.props.native.auth &&
            !this.state.openModal &&
            (auth !== this.props.native.auth || secure !== this.props.native.secure)
        ) {
            this.setState({ openModal: true });
        }
    }

    renderConfirmDialog() {
        return (
            <Dialog
                open={this.state.confirmSocketIO}
                maxWidth="md"
                onClose={() => this.setState({ confirmSocketIO: false })}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">{I18n.t('Warning')}</DialogTitle>
                <DialogContent>
                    {I18n.t('whitelist_only_with_integrated_socket')}
                    <br />
                    {I18n.t('White list will be disabled. Please confirm.')}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="contained"
                        color="primary"
                        autoFocus
                        onClick={() => {
                            this.props.onChange('whiteListEnabled', false, () =>
                                this.props.onChange('socketio', this.state.confirmValue, () =>
                                    this.setState({ confirmSocketIO: false }),
                                ),
                            );
                        }}
                    >
                        {I18n.t('Ok')}
                    </Button>
                    <Button
                        color="grey"
                        variant="contained"
                        onClick={() => this.setState({ confirmSocketIO: false })}
                    >
                        {I18n.t('Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    render() {
        const { instance, common, native, onLoad, onChange } = this.props;
        const { certificatesOptions, ipAddressOptions, usersOptions, openModal, toast, socketioOptions, ready } =
            this.state;

        if (!ready) {
            return <LinearProgress />;
        }

        const newCommon = JSON.parse(JSON.stringify(common));
        newCommon.icon = newCommon.extIcon;

        return (
            <form style={styles.tab}>
                <Toast
                    message={toast}
                    onClose={() => this.setState({ toast: '' })}
                />
                {this.renderConfirmDialog()}
                <CustomModal
                    open={openModal}
                    buttonClick={() => {
                        onChange('auth', false);
                        this.setState({ openModal: !openModal, toast: 'Authentication_deactivated' });
                    }}
                    close={() => this.setState({ openModal: !openModal })}
                    titleButton={I18n.t('button_title')}
                    titleButton2={I18n.t('button_title2')}
                >
                    <div style={styles.blockWarningContent}>
                        <Security style={{ width: 32, height: 32 }} />
                        {I18n.t('modal_title')}
                    </div>
                </CustomModal>
                <Logo
                    instance={instance}
                    common={newCommon}
                    native={native}
                    onError={text => console.error(text)}
                    onLoad={onLoad}
                />
                <div style={{ ...styles.column, ...styles.columnSettings }}>
                    <div>
                        <CustomSelect
                            title="IP address"
                            attr="bind"
                            noTranslate
                            sx={styles.ipInputStyle}
                            options={ipAddressOptions}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomInput
                            title="port"
                            attr="port"
                            type="number"
                            style={{ marginTop: 5 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                    <div style={styles.blockWrapperCheckbox}>
                        <Box
                            component="div"
                            sx={styles.blockWrapper}
                        >
                            <CustomCheckbox
                                title="encryption"
                                attr="secure"
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={onChange}
                            />
                            <CustomCheckbox
                                title="authentication"
                                attr="auth"
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={onChange}
                            />
                            {native.auth ? (
                                <CustomCheckbox
                                    title="basic_authentication"
                                    attr="basicAuth"
                                    style={{ marginTop: 10 }}
                                    native={native}
                                    onChange={onChange}
                                />
                            ) : null}
                            <CustomCheckbox
                                title="cache"
                                attr="cache"
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={onChange}
                            />
                            <CustomSelect
                                title="socket"
                                attr="socketio"
                                noTranslate
                                options={socketioOptions}
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={(attr, value, cb) => {
                                    if (value && native.whiteListEnabled) {
                                        this.setState({ confirmSocketIO: true, confirmValue: value });
                                    } else {
                                        onChange(attr, value, cb);
                                    }
                                }}
                            />
                            {!native.socketio ? (
                                <CustomCheckbox
                                    title="usePureWebSockets"
                                    attr="usePureWebSockets"
                                    style={{ marginTop: 10 }}
                                    native={native}
                                    onChange={onChange}
                                />
                            ) : null}
                            {(!native.socketio || native.socketio.startsWith('system.adapter.socket')) &&
                            !native.usePureWebSockets ? (
                                <CustomCheckbox
                                    title="web_sockets"
                                    help={
                                        native.socketio?.startsWith('system.adapter.socket')
                                            ? I18n.t('Same settings must be set in socketio instance')
                                            : ''
                                    }
                                    attr="forceWebSockets"
                                    style={{
                                        marginTop: 10,
                                    }}
                                    native={native}
                                    onChange={onChange}
                                />
                            ) : null}
                        </Box>
                        <Box
                            component="div"
                            sx={styles.blockWrapper}
                        >
                            {native.secure ? (
                                <div style={styles.blockWrapperCheckbox}>
                                    <CustomSelect
                                        title="public_certificate"
                                        attr="certPublic"
                                        noTranslate
                                        options={[
                                            { title: I18n.t('nothing'), value: '' },
                                            ...certificatesOptions
                                                .filter(({ type }) => !type || type === 'public')
                                                .map(({ name }) => ({ title: name, value: name })),
                                        ]}
                                        style={{ marginTop: 10, marginRight: 20 }}
                                        native={native}
                                        onChange={onChange}
                                    />
                                    <CustomSelect
                                        title="private_certificate"
                                        attr="certPrivate"
                                        noTranslate
                                        options={[
                                            { title: I18n.t('nothing'), value: '' },
                                            ...certificatesOptions
                                                .filter(({ type }) => !type || type === 'private')
                                                .map(({ name }) => ({ title: name, value: name })),
                                        ]}
                                        style={{ marginTop: 10, marginRight: 20 }}
                                        native={native}
                                        onChange={onChange}
                                    />
                                    <CustomSelect
                                        title="chained_certificate"
                                        attr="certChained"
                                        noTranslate
                                        options={[
                                            { title: I18n.t('nothing'), value: '' },
                                            ...certificatesOptions
                                                .filter(({ type }) => !type || type === 'chained')
                                                .map(({ name }) => ({ title: name, value: name })),
                                        ]}
                                        style={{ marginTop: 10 }}
                                        native={native}
                                        onChange={onChange}
                                    />
                                </div>
                            ) : null}
                            {!native.auth ? (
                                <CustomSelect
                                    title="users"
                                    attr="defaultUser"
                                    themeType={this.props.themeType}
                                    noTranslate
                                    options={usersOptions.map(({ _id, common: { name, color, icon } }) => ({
                                        title:
                                            typeof name === 'object'
                                                ? name[this.props.lang] ||
                                                  name.end ||
                                                  _id.replace(/^system\.user\./, '')
                                                : name,
                                        value: _id.replace(/^system\.user\./, ''),
                                        color,
                                        icon,
                                    }))}
                                    style={{
                                        marginTop: 10,
                                        width: 300,
                                    }}
                                    native={native}
                                    onChange={onChange}
                                />
                            ) : null}
                            {native.auth ? (
                                <CustomInput
                                    title="time_out"
                                    attr="ttl"
                                    type="number"
                                    style={{ marginTop: -1, width: 300 }}
                                    native={native}
                                    onChange={onChange}
                                />
                            ) : null}
                            <div>{I18n.t('Simple API is now working as Web-Extension. Please create an instance and make settings there.')}</div>
                            <CustomCheckbox
                                title="Do not check if this instance is available from internet"
                                attr="doNotCheckPublicIP"
                                style={{ marginTop: 10 }}
                                native={native}
                                onChange={onChange}
                            />
                        </Box>
                    </div>
                </div>
            </form>
        );
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
};

export default Options;
