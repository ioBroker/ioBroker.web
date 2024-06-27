import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    IconButton,
    TableRow, Box,
} from '@mui/material';

import {
    Delete as DeleteIcon,
    AddCircle as AddCircleIcon,
} from '@mui/icons-material';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

import CustomCheckbox from '../Components/CustomCheckbox';
import CustomInput from '../Components/CustomInput';
import CustomSelect from '../Components/CustomSelect';
import Toast from '../Components/Toast';

const styles = {
    backgroundTheme: theme => ({
        background: theme.palette.mode === 'dark' ? '#3e3838' : '#dcdcdc',
    }),
    tab: {
        width: '100%',
        minHeight: '100%',
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
    },
    columnSettings: {
        width: '100%',
    },
    table: {
        minWidth: 700,
        '& td': {
            p: '2px',
        },
        '@media screen and (max-width: 1700px)': {
            '& th': {
                p: '2px',
            },
        },
        '@media screen and (max-width: 1280px)': {
            minWidth: 300,
        },
    },
    displayNone: {
        display: 'none',
    },
    checkBoxStyle: {
        marginLeft: 0,
        marginRight: 0,
    },
    miniTable: {
        display: 'none',
        '@media screen and (max-width: 1280px)': {
            display: 'block',
        },
    },
    card: {
        padding: 1,
        margin: '20px 0',
        border: '1px solid',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    maxTable: {
        '@media screen and (max-width: 1280px)': {
            display: 'none',
        },
    },
    miniTableSelect: {
        '@media screen and (max-width: 1280px)': {
            minWidth: 185,
        },
    },
    warning: {
        color: '#FF4040',
        fontSize: 18,
        display: 'inline-block',
    },
};

const baseObj = {
    user: 'admin',
    object: {
        read: true,
        list: true,
        write: true,
        delete: true,
    },
    state: {
        read: true,
        list: true,
        write: true,
        create: true,
        delete: true,
    },
    file: {
        read: true,
        list: true,
        write: true,
        create: true,
        delete: true,
    },
};
class WhiteList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            toast: '',
            usersOptions: [],
        };

        if (props.native.bind && props.native.bind !== 'localhost' && props.native.bind !== '0.0.0.0') {
            const numbers = props.native.bind.split('.');
            numbers.pop();
            this.ipPrefix = numbers.join('.');
        }
    }

    componentDidMount() {
        this.props.socket.getUsers()
            .then(list => {
                // try to find out IP prefix
                if (!this.ipPrefix) {
                    this.props.socket.getObject(`system.adapter.${this.props.adapterName}.${this.props.instance}`)
                        .then(obj => {
                            this.props.socket.getIpAddresses(obj.common.host)
                                .then(interfaces => {
                                    interfaces = interfaces.filter(ip => ip.includes('.'));
                                    if (interfaces.length) {
                                        const numbers = interfaces[0].split('.');
                                        numbers.pop();
                                        this.ipPrefix = numbers.join('.');
                                    } else {
                                        this.ipPrefix = '192.168.0';
                                    }
                                });
                        });
                }

                this.setState({ usersOptions: list });
            });
    }

    static getText(text) {
        if (typeof text === 'string') {
            return text;
        }

        return text[I18n.getLanguage()] || text.en;
    }

    userSelect(el, style) {
        const { native, onChange } = this.props;
        const { usersOptions } = this.state;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return whiteListSettings[el].user;
        }
        const optionsSelect = whiteListSettings.default.user === 'auth' ? [{ title: 'auth', value: 'auth' }] : [];

        return <CustomSelect
            table
            value={whiteListSettings[el].user}
            options={[...optionsSelect, ...usersOptions.map(({ _id, common: { name } }) => ({ title: WhiteList.getText(name), value: _id.replace('system.user.', '') }))]}
            native={native}
            sx={{ ...styles.miniTableSelect, ...style }}
            noTranslate
            onChange={e => {
                const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                newObj[el].user = e;
                onChange('whiteListSettings', newObj);
            }}
        />;
    }

    tableInput(el, style) {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return <div style={{ padding: '10px 0' }}>{el}</div>;
        }
        return <CustomInput
            table
            value={el}
            style={style}
            onChange={e => {
                const copyObj = JSON.parse(JSON.stringify(whiteListSettings));
                const newObj = {};
                Object.keys(copyObj).forEach(keyObj => {
                    if (keyObj === el) {
                        newObj[e] = copyObj[keyObj];
                    } else {
                        newObj[keyObj] = copyObj[keyObj];
                    }
                });
                if (!WhiteList.validateIp(e)) {
                    this.setState({ toast: 'incorrect_ip' });
                } else {
                    onChange('whiteListSettings', newObj);
                }
            }}
        />;
    }

    buttonAdd() {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;

        return <IconButton
            color="primary"
            onClick={() => {
                let newObj = JSON.parse(JSON.stringify(whiteListSettings));
                let number = 1;
                let newKey = `${this.ipPrefix}.1`;
                const addProperty = () => {
                    if (Object.keys(newObj).find(keySearch => keySearch === newKey)) {
                        newKey = `${this.ipPrefix}.${number}`;
                        number += 1;
                        addProperty();
                    }
                };
                addProperty();
                newObj = { [newKey]: baseObj, ...newObj };
                onChange('whiteListSettings', newObj);
            }}
        >
            <AddCircleIcon />
        </IconButton>;
    }

    buttonRemove(el) {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;

        return <IconButton
            color="primary"
            onClick={() => {
                const copyObj = JSON.parse(JSON.stringify(whiteListSettings));
                delete copyObj[el];
                onChange('whiteListSettings', copyObj);
            }}
            style={el === 'default' ? { display: 'none' } : null}
            aria-label="delete"
        >
            <DeleteIcon />
        </IconButton>;
    }

    static validateIp(ip) {
        if (ip.indexOf('*') !== -1 && ip.lastIndexOf('.') > ip.indexOf('*')) {
            return false;
        }
        const expression = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
        return expression.test(ip.replace('*', '111'));
    }

    render() {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        const { toast } = this.state;
        const tableHeadArr = ['to_read', 'list', 'write', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete'];

        return <form style={styles.tab}>
            <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
            <div style={{ ...styles.column, ...styles.columnSettings, position: 'relative' }}>
                <CustomCheckbox
                    title="included"
                    attr="whiteListEnabled"
                    disabled={this.props.native.socketio}
                    native={native}
                    onChange={(attr, value) => onChange(attr, value, () => {
                        if (value && !native.whiteListSettings) {
                            onChange('whiteListSettings', {
                                default: {
                                    user: 'auth',
                                },
                            });
                        }
                    })}
                />
                {this.props.native.socketio ? <span style={styles.warning}>{I18n.t('whitelist_only_with_integrated_socket')}</span> : null}
                {!this.props.native.socketio && whiteListSettings ? <div style={native.whiteListEnabled ? null : styles.displayNone}>
                    <TableContainer style={{ overflowX: 'visible' }} component={Paper}>
                        <Table sx={{ ...styles.table, ...styles.maxTable }} aria-label="spanning table">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" rowSpan={2}>{this.buttonAdd()}</TableCell>
                                    <TableCell align="center" rowSpan={2} style={{ fontWeight: 'bold' }}>IP</TableCell>
                                    <TableCell align="center" rowSpan={2} style={{ fontWeight: 'bold' }}>{I18n.t('user')}</TableCell>
                                    <TableCell align="center" colSpan={4} style={{ fontWeight: 'bold' }}>{I18n.t('object')}</TableCell>
                                    <TableCell align="center" colSpan={5} style={{ fontWeight: 'bold' }}>{I18n.t('status')}</TableCell>
                                    <TableCell align="center" colSpan={5} style={{ fontWeight: 'bold' }}>{I18n.t('file')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    {tableHeadArr.map((el, index) =>
                                        <TableCell key={`${el}_${index}_max`} align="center">{I18n.t(el)}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.keys(whiteListSettings).map((el, index) =>
                                    <TableRow key={`${index}_max`}>
                                        <TableCell sx={styles.backgroundTheme} style={{ borderBottom: '1px solid #afafaf' }}>
                                            {this.buttonRemove(el)}
                                        </TableCell>
                                        <TableCell
                                            sx={styles.backgroundTheme}
                                            style={{ borderBottom: '1px solid #afafaf', color: el === 'default' ? '#006ccd' : undefined }}
                                            title={el === 'default' ? I18n.t('If no IP address matches, show authentication dialog') : ''}
                                        >
                                            {this.tableInput(el, { marginTop: 0, minWidth: 150, paddingTop: 0 })}
                                        </TableCell>
                                        <TableCell sx={styles.backgroundTheme} style={{ borderBottom: '1px solid #afafaf' }}>
                                            {this.userSelect(el, { marginTop: -1 })}
                                        </TableCell>
                                        {['object', 'state', 'file'].map((elProperty, indexProperty) =>
                                            Object.keys(whiteListSettings[el][elProperty] || {}).map(attr =>
                                                <TableCell sx={indexProperty % 2 ? styles.backgroundTheme : undefined} style={{ borderBottom: indexProperty % 2 ? '1px solid #afafaf' : null }} key={`${elProperty}_${attr}_max`} align="center">
                                                    <CustomCheckbox
                                                        table
                                                        checked={whiteListSettings[el][elProperty][attr]}
                                                        attr={attr}
                                                        native={native}
                                                        style={styles.checkBoxStyle}
                                                        onChange={e => {
                                                            const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                            newObj[el][elProperty][attr] = e;
                                                            onChange('whiteListSettings', newObj);
                                                        }}
                                                    />
                                                </TableCell>))}
                                    </TableRow>)}
                            </TableBody>
                        </Table>
                        <Box component="div" sx={styles.miniTable}>
                            <Box
                                component="div"
                                sx={styles.backgroundTheme}
                                style={{
                                    position: 'sticky',
                                    top: -10,
                                    left: 12,
                                    zIndex: 22,
                                    borderBottom: '1px solid',
                                }}
                            >
                                {this.buttonAdd()}
                            </Box>
                            <div>
                                {Object.keys(whiteListSettings).map((el, index) => <Box
                                    component="div"
                                    key={`${index}_wrapper`}
                                    sx={Utils.getStyle(this.props.theme, styles.card, index % 2 ? styles.backgroundTheme : null)}
                                >
                                    <div style={{ width: '100%', lineHeight: '30px', textAlign: 'center' }}>
                                        <span>{this.buttonRemove(el)}</span>
                                        <span style={{ marginLeft: 10 }}>
IP:
                                            {this.tableInput(el, {
                                                marginTop: -5, minWidth: 150, marginLeft: 5, verticalAlign: 'middle',
                                            })}
                                        </span>
                                        <span style={{ marginLeft: 20 }}>
                                            {I18n.t('user')}
:
                                            {' '}
                                            {this.userSelect(el, { marginTop: -10, marginLeft: 5, verticalAlign: 'middle' })}
                                        </span>
                                    </div>
                                    {['object', 'state', 'file'].map((element, indexEl) => {
                                        const newTableHeadArr = [...tableHeadArr].splice(indexEl === 0 ? 0 : 4, indexEl === 0 ? 4 : 5);
                                        return <Table key={`${indexEl}_mini`} sx={styles.table} style={{ width: 'inherit' }} aria-label="spanning table">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell style={{ background: '#bbbbbb' }} align="center" colSpan={Object.keys(whiteListSettings[el][element] || {}).length}>
                                                        {I18n.t(['object', 'status', 'file'][indexEl])}
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    {newTableHeadArr.map((elhed, ind) => <TableCell key={`${elhed}_${ind}_mini`} align="center">
                                                        {I18n.t(elhed)}
                                                    </TableCell>)}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                <TableRow>
                                                    {Object.keys(whiteListSettings[el][element] || {}).map(attr =>
                                                        <TableCell key={`${element}_${attr}_mini_check`} align="center">
                                                            <CustomCheckbox
                                                                table
                                                                checked={whiteListSettings[el][element][attr]}
                                                                attr={attr}
                                                                native={native}
                                                                style={styles.checkBoxStyle}
                                                                onChange={e => {
                                                                    const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                                    newObj[el][element][attr] = e;
                                                                    onChange('whiteListSettings', newObj);
                                                                }}
                                                            />
                                                        </TableCell>)}
                                                </TableRow>
                                            </TableBody>
                                        </Table>;
                                    })}
                                </Box>)}
                            </div>
                        </Box>
                    </TableContainer>
                </div> : null}
            </div>
        </form>;
    }
}

WhiteList.propTypes = {
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onChange: PropTypes.func,
    theme: PropTypes.object,
    socket: PropTypes.object.isRequired,
};

export default WhiteList;
