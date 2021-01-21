import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import CustomCheckbox from '../Components/CustomCheckbox';
import CustomInput from '../Components/CustomInput';
import HintComponent from '../Components/HintComponent';
import logo from '../assets/le.png'

const styles = theme => ({
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
        width: 'calc(100% - 10px)'
    },
    logo_width: {
        width: 200
    },
    fotn_size: {
        '@media screen and (max-width: 460px)': {
            '& > *': {
                fontSize: '3.2vw',
            }
        }
    }

});

class Certificates extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false,
            ipAdressOptions: []
        };
        const { socket, adapterName, instance } = this.props;
        socket.getState(`system.adapter.${adapterName}.${instance}.alive`).then(state =>
            this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        const { socket, adapterName, instance, common: { host } } = this.props;
        socket.getIpAddresses(host)
            .then(list => {
                this.setState({ ipAdressOptions: list })
            });
        socket.subscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    componentWillUnmount() {
        const { socket, adapterName, instance } = this.props;
        socket.unsubscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const { adapterName, instance } = this.props;
        if (id === `system.adapter.${adapterName}.${instance}.alive`) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    render() {
        const { classes, native, onChange, common: { readme } } = this.props;
        return <form className={classes.tab}>
            <img className={classes.logo_width} alt='logo' src={logo} />
            <div className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomCheckbox
                        title='use_certificates'
                        attr='leEnabled'
                        className={classes.fotn_size}
                        native={native}
                        onChange={onChange}
                    />
                    <HintComponent openLink={() => {
                        window.open(`${readme}#lets-encrypt-certificates`, '_blank');
                    }} />
                </div>
                <div style={native['leEnabled'] ? { display: 'block' } : { display: 'none' }}>
                    <CustomCheckbox
                        title='renew_certificates'
                        attr='leUpdate'
                        className={classes.fotn_size}
                        native={native}
                        onChange={onChange}
                    />
                    <HintComponent openLink={() => {
                        window.open(`${readme}#lets-encrypt-certificates`, '_blank');
                    }} />
                </div>
                <div style={native['leUpdate'] && native['leEnabled'] ? { display: 'block' } : { display: 'none' }}>
                    <CustomInput
                        title='domain_name'
                        attr='lePort'
                        type='number'
                        style={{ marginTop: -1 }}
                        native={native}
                        onChange={onChange}
                    />
                    <HintComponent style={{ marginTop: 10, marginLeft: 20 }} openLink={() => {
                        window.open(`${readme}#lets-encrypt-certificates`, '_blank');
                    }} />
                </div>
            </div>
        </form>;
    }
}

Certificates.propTypes = {
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

export default withStyles(styles)(Certificates);
