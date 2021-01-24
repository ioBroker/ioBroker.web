import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import CustomCheckbox from '../Components/CustomCheckbox';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';
import CustomInput from '../Components/CustomInput';
import CustomSelect from '../Components/CustomSelect';
import I18n from '@iobroker/adapter-react/i18n';
import Toast from '../Components/Toast';

const styles = ({ name }) => ({
    background_theme: {
        background: name === 'dark' ? '#3e3838' : '#dcdcdc'
    },
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    button: {
        marginRight: 20,
        marginBottom: 40,
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top'
    },
    columnSettings: {
        width: '100%',
    },
    table: {
        minWidth: 700,
        '& td': {
            padding: 2
        }
    },
    display_none: {
        display: 'none'
    },
    check_box_style: {
        marginLeft: 0,
        marginRight: 0
    },
    mini_table: {
        display: 'none'
    },
    card: {
        padding: 1,
        margin: '20px 0',
        border: '1px solid',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    '@media screen and (max-width: 1700px)': {
        table: {
            '& th': {
                padding: 2
            }
        }
    },
    '@media screen and (max-width: 1280px)': {
        mini_table: {
            display: 'block'
        },
        max_table: {
            display: 'none'
        },
        table: {
            minWidth: 300
        },
        mini_table_select: {
            minWidth: 185
        }
    }
});

const baseObj = {
    user: 'admin',
    object: {
        read: true,
        list: true,
        write: true,
        delete: true
    },
    state: {
        read: true,
        list: true,
        write: true,
        create: true,
        delete: true
    },
    file: {
        read: true,
        list: true,
        write: true,
        create: true,
        delete: true
    }
}
class WhiteList extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false
        };
        const { socket, instance, adapterName } = this.props;
        socket.getState(`system.adapter.${adapterName}.${instance}.alive`).then(state =>
            this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        const { socket, instance, adapterName } = this.props;
        socket.subscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    componentWillUnmount() {
        const { socket, instance, adapterName } = this.props;
        socket.unsubscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const { instance, adapterName } = this.props;
        if (id === `system.adapter.${adapterName}.${instance}.alive`) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    tableSelect(el, style) {
        const { classes, native, onChange } = this.props;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return whiteListSettings[el].user
        }
        return <CustomSelect
            table
            value={whiteListSettings[el].user}
            options={[{ title: 'auth', value: 'auth' }, { title: 'admin', value: 'admin' },]}
            native={native}
            style={style}
            className={classes.mini_table_select}
            onChange={(e) => {
                const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                newObj[el].user = e;
                onChange('whiteListSettings', newObj);
            }}
        />
    }

    tableInput(el, style) {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        if (el === 'default') {
            return el;
        }
        return <CustomInput
            table
            value={el}
            style={style}
            onChange={(e) => {
                const copyObj = JSON.parse(JSON.stringify(whiteListSettings));
                let newObj = {};
                Object.keys(copyObj).forEach(keyObj => {
                    if (keyObj === el) {
                        newObj[e] = copyObj[keyObj];
                    } else {
                        newObj[keyObj] = copyObj[keyObj];
                    }
                });
                if (!this.validateIp(e)) {
                    this.setState({ toast: 'incorrect_ip' })
                } else {
                    onChange('whiteListSettings', newObj);
                }
            }}
        />
    }

    buttonAdd() {
        const { native, onChange } = this.props;
        const { whiteListSettings } = native;
        return <IconButton color="primary" onClick={() => {
            let newObj = JSON.parse(JSON.stringify(whiteListSettings));
            let number = 1;
            let newKey = '192.168.0.1';
            const addProperty = () => {
                if (Object.keys(newObj).find(keySearch => keySearch === newKey)) {
                    newKey = `192.168.0.${number}`;
                    number = number + 1;
                    addProperty();
                }
            }
            addProperty();
            newObj = Object.assign({ [newKey]: baseObj }, newObj);
            onChange('whiteListSettings', newObj);
        }}>
            <AddCircleIcon />
        </IconButton>
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
        </IconButton>
    }

    validateIp(ip) {
        if (ip.indexOf('*') !== -1 && ip.lastIndexOf('.') > ip.indexOf('*')) {
            return false;
        }
        let expression = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
        return expression.test(ip.replace('*', '111'));
    }

    render() {
        const { classes, native, onChange } = this.props;
        const { whiteListSettings } = native;
        const { toast } = this.state;
        const tableHeadArr = ['to_read', 'list', 'write', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete', 'to_read', 'list', 'write', 'to_create', 'delete'];
        return <form className={classes.tab}>
            <Toast message={toast} onClose={() => this.setState({ toast: '' })} />
            <div style={{ position: 'relative' }} className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomCheckbox
                        title='included'
                        attr='whiteListEnabled'
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div className={native['whiteListEnabled'] ? null : classes.display_none}>
                    <TableContainer style={{ overflowX: 'visible' }} component={Paper}>
                        <Table className={`${classes.table} ${classes.max_table}`} aria-label="spanning table">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" rowSpan={2}>{this.buttonAdd()}</TableCell>
                                    <TableCell align="center" rowSpan={2} style={{fontWeight: 'bold'}}>IP</TableCell>
                                    <TableCell align="center" rowSpan={2} style={{fontWeight: 'bold'}}>{I18n.t('user')}</TableCell>
                                    <TableCell align="center" colSpan={4} style={{fontWeight: 'bold'}}>{I18n.t('object')}</TableCell>
                                    <TableCell align="center" colSpan={5} style={{fontWeight: 'bold'}}>{I18n.t('status')}</TableCell>
                                    <TableCell align="center" colSpan={5} style={{fontWeight: 'bold'}}>{I18n.t('file')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    {tableHeadArr.map((el, index) =>
                                        <TableCell key={`${el}_${index}_max`} align="center">{I18n.t(el)}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.keys(whiteListSettings).map((el, index) => {
                                    return <TableRow key={`${index}_max`}>
                                        <TableCell className={classes.background_theme} style={{ borderBottom: '1px solid #afafaf' }}>
                                            {this.buttonRemove(el)}
                                        </TableCell>
                                        <TableCell className={classes.background_theme} style={{ borderBottom: '1px solid #afafaf' }}>
                                            {this.tableInput(el, { marginTop: -1, minWidth: 150, paddingTop: 5 })}
                                        </TableCell>
                                        <TableCell className={classes.background_theme} style={{ borderBottom: '1px solid #afafaf' }}>
                                            {this.tableSelect(el, { marginTop: -1 })}
                                        </TableCell>
                                        {['object', 'state', 'file'].map((elProperty, indexProperty) => Object.keys(whiteListSettings[el][elProperty]).map((attr, index) =>
                                            <TableCell className={Boolean(indexProperty % 2) ? classes.background_theme : null} style={{ borderBottom: Boolean(indexProperty % 2) ? '1px solid #afafaf' : null }} key={`${elProperty}_${attr}_max`} align="center">
                                                <CustomCheckbox
                                                    table
                                                    checked={whiteListSettings[el][elProperty][attr]}
                                                    attr={attr}
                                                    native={native}
                                                    className={classes.check_box_style}
                                                    onChange={(e) => {
                                                        const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                        newObj[el][elProperty][attr] = e;
                                                        onChange('whiteListSettings', newObj);
                                                    }}
                                                />
                                            </TableCell>))}
                                    </TableRow>
                                })}
                            </TableBody>
                        </Table>
                        <div className={classes.mini_table}>
                            <div className={classes.background_theme} style={{ position: 'sticky', top: -10, left: 12, zIndex: 22, borderBottom: '1px solid' }}>
                                {this.buttonAdd()}
                            </div>
                            <div>
                                {Object.keys(whiteListSettings).map((el, index) => {
                                    return <div
                                        key={`${index}_wrapper`}
                                        className={`${classes.card} ${Boolean(index % 2) ? classes.background_theme : null}`}
                                    >
                                        <div style={{ width: '100%', lineHeight: '30px', textAlign: 'center' }}>
                                            <span>{this.buttonRemove(el)}</span>
                                            <span style={{marginLeft: 10}}>IP: {this.tableInput(el, { marginTop: -5, minWidth: 150, marginLeft: 5, verticalAlign: 'middle'})}</span>
                                            <span style={{marginLeft: 20}}>{I18n.t('user')}: {this.tableSelect(el, { marginTop: -10, marginLeft: 5, verticalAlign: 'middle' })}</span>
                                        </div>
                                        {['object', 'state', 'file'].map((element, indexEl) => {
                                            let newTableHeadArr = [...tableHeadArr].splice(indexEl === 0 ? 0 : 4, indexEl === 0 ? 4 : 5)
                                            return <Table key={`${indexEl}_mini`} className={classes.table} style={{width: 'inherit'}} aria-label="spanning table">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell style={{ background: '#bbbbbb' }} align="center" colSpan={Object.keys(whiteListSettings[el][element]).length}>
                                                            {I18n.t(['object', 'status', 'file'][indexEl])}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        {newTableHeadArr.map((elhed, ind) => (<TableCell key={`${elhed}_${ind}_mini`} align="center">
                                                            {I18n.t(elhed)}</TableCell>))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    <TableRow>
                                                        {Object.keys(whiteListSettings[el][element]).map((attr) =>
                                                            <TableCell key={`${element}_${attr}_mini_check`} align="center">
                                                                <CustomCheckbox
                                                                    table
                                                                    checked={whiteListSettings[el][element][attr]}
                                                                    attr={attr}
                                                                    native={native}
                                                                    className={classes.check_box_style}
                                                                    onChange={(e) => {
                                                                        const newObj = JSON.parse(JSON.stringify(whiteListSettings));
                                                                        newObj[el][element][attr] = e;
                                                                        onChange('whiteListSettings', newObj);
                                                                    }}
                                                                />
                                                            </TableCell>)}
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        })}</div>
                                })}
                            </div>
                        </div>
                    </TableContainer>
                </div>
            </div>
        </form>;
    }
}

WhiteList.propTypes = {
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

export default withStyles(styles)(WhiteList);
