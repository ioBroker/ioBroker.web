import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import { MdClose as IconClose } from 'react-icons/md';
import Logo from '@iobroker/adapter-react/Components/Logo';
import CustomSelect from '../Components/CustomSelect';
import CustomInput from '../Components/CustomInput';
import CustomCheckbox from '../Components/CustomCheckbox';
import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({
    block_wrapper: {
        display: 'flex',
        flexDirection: 'column',
        marginRight: 20,
        '@media screen and (max-width: 360px)': {
            marginRight: 0
        }
    },
    display_none: {
        display: 'none'
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
    block_wrapper_checkbox: {
        display: 'flex',
        flexFlow: 'wrap'
    },
    ip_input_style: {
        marginTop: 10,
        width: 900,
        marginRight: 20,
        '@media screen and (max-width: 940px)': {
            width: '100%'
        }
    }
});

class Options extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false,
            ipAdressOptions: [],
            certificatesOptions: [],
            usersOptions: []
        };
        const { instance, socket, adapterName } = this.props;
        socket.getState(`system.adapter.${adapterName}.${instance}.alive`).then(state =>
            this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        const { instance, socket, adapterName, common: { host } } = this.props;
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
                                IPs4.push({ title: '[' + data.native.hardware.networkInterfaces[eth][num].family + '] ' + data.native.hardware.networkInterfaces[eth][num].address + ' - ' + eth, value: data.native.hardware.networkInterfaces[eth][num].address, family: 'ipv4' });
                            } else {
                                IPs6.push({ title: '[' + data.native.hardware.networkInterfaces[eth][num].family + '] ' + data.native.hardware.networkInterfaces[eth][num].address + ' - ' + eth, value: data.native.hardware.networkInterfaces[eth][num].address, family: 'ipv6' });
                            }
                        }
                    }
                }
                for (let i = 0; i < IPs6.length; i++) {
                    IPs4.push(IPs6[i]);
                }
                this.setState({ ipAdressOptions: IPs4 })
            }
        })
        socket.getCertificates()
            .then(list => {
                this.setState({ certificatesOptions: list })
            });
        socket.getUsers()
            .then(list => {
                this.setState({ usersOptions: list })
            });
        socket.subscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    componentWillUnmount() {
        const { instance, socket, adapterName } = this.props;
        socket.unsubscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const { instance, adapterName } = this.props;
        if (id === `system.adapter.${adapterName}.${instance}.alive`) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    renderToast() {
        const { classes } = this.props;
        const { toast } = this.state;
        if (!toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({ toast: '' })}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={classes.close}
                        onClick={() => this.setState({ toast: '' })}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    render() {
        const { instance, common, classes, native, onLoad, onChange } = this.props;
        const { certificatesOptions, ipAdressOptions, usersOptions } = this.state;
        return <form className={classes.tab}>
            <Logo
                instance={instance}
                common={common}
                native={native}
                onError={text => this.setState({ errorText: text })}
                onLoad={onLoad}
            />
            <div className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomSelect
                        title='ip'
                        attr='bind'
                        className={classes.ip_input_style}
                        options={ipAdressOptions}
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
                <div className={classes.block_wrapper_checkbox}>
                    <div className={classes.block_wrapper}>
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
                            className={native['auth'] ? null : classes.display_none}
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
                            options={[
                                { title: I18n.t('nothing'), value: 'none' },
                                { title: I18n.t('built_in'), value: '' }
                            ]}
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                    <div className={classes.block_wrapper}>
                        <CustomSelect
                            className={native['secure'] ? null : classes.display_none}
                            title='public_certificate'
                            attr='certPublic'
                            options={[
                                { title: I18n.t('nothing'), value: '' }, ...certificatesOptions.filter(({ type }) => type === 'public').map(({ name }) => ({ title: name, value: name }))
                            ]}
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomSelect
                            className={!native['auth'] ? null : classes.display_none}
                            title='users'
                            attr='defaultUser'
                            options={usersOptions.map(({ common: { name } }) => ({ title: name, value: name }))}
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomInput
                            className={native['auth'] ? null : classes.display_none}
                            title='time_out'
                            attr='ttl'
                            type='number'
                            style={{ marginTop: -1 }}
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
                            title='web_sockets'
                            attr='forceWebSockets'
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                    <div className={classes.block_wrapper_checkbox} >
                        <CustomSelect
                            className={native['secure'] ? null : classes.display_none}
                            title='private_certificate'
                            attr='certPrivate'
                            options={[
                                { title: I18n.t('nothing'), value: '' }, ...certificatesOptions.filter(({ type }) => type === 'private').map(({ name }) => ({ title: name, value: name }))
                            ]}
                            style={{ marginTop: 10, marginRight: 20 }}
                            native={native}
                            onChange={onChange}
                        />
                        <CustomSelect
                            className={native['secure'] ? null : classes.display_none}
                            title='chained_certificate'
                            attr='certChained'
                            options={[
                                { title: I18n.t('nothing'), value: '' }, ...certificatesOptions.filter(({ type }) => type === 'chained').map(({ name }) => ({ title: name, value: name }))
                            ]}
                            style={{ marginTop: 10 }}
                            native={native}
                            onChange={onChange}
                        />
                    </div>
                </div>
            </div>
            {this.renderToast()}
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
};

export default withStyles(styles)(Options);