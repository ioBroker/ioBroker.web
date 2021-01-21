import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import CustomCheckbox from '../Components/CustomCheckbox';
import CustomInput from '../Components/CustomInput';
import CustomButtonUpload from '../Components/CustomButtonUpload';
import I18n from '@iobroker/adapter-react/i18n';
import Dropzone from 'react-dropzone';

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
        width: 'calc(100% - 10px)',
    },
    drop_zone: {
        marginTop: 30,
        width: 600,
        border: '2px dashed #bbb',
        borderRadius: '5px',
        padding: '25px',
        textAlign: 'center',
        fontSize: '20pt',
        fontWeight: 'bold',
        fontFamily: 'Arial',
        color: '#bbb',
        minWidth: '320px',
        minHeight: '200px',
        transition: 'background 1s',
        "&:focus": {
            outline: 'inherit'
        }
    },
    drop_zone_active: {
        background: '#d6d6d69c'
    },
    imgStyle: {
        maxWidth: 500,
        maxHeight: 500
    },
    '@media screen and (max-width: 680px)': {
        drop_zone: {
            width: 'calc(100% - 45px)',
            minWidth: '200px',
        },
        imgStyle: {
            width: '100%',
        }
    }
});

class Background extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inAction: false,
            toast: '',
            isInstanceAlive: false,
            errorWithPercent: false,
            imgSRC: ''
        };
        const { socket, instance, adapterName } = this.props;
        socket.getState(`system.adapter.${adapterName}.${instance}.alive`).then(state =>
            this.setState({ isInstanceAlive: state && state.val }));
    }

    componentDidMount() {
        const { socket, instance, adapterName } = this.props;
        this.readFile();
        socket.subscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    componentWillUnmount() {
        const { socket, instance, adapterName } = this.props;
        socket.unsubscribeState(`system.adapter.${adapterName}.${instance}.alive`, this.onAliveChanged);
    }

    onAliveChanged = (id, state) => {
        const { adapterName, instance } = this.props;
        if (id === `system.adapter.${adapterName}.${instance}.alive`) {
            this.setState({ isInstanceAlive: state && state.val });
        }
    };

    readFile() {
        const { socket } = this.props;
        socket.getRawSocket().emit('readFile', 'web.0', 'login-bg.png', (err, data) => {
            if (!err && data) {
                let arrayBufferView = new Uint8Array(data);
                let blob = new Blob([arrayBufferView], { type: 'image/png' });
                let urlCreator = window.URL || window.webkitURL;
                let imgSRC = urlCreator.createObjectURL(blob);
                this.setState({ imgSRC });
            } else {
                this.setState({ imgSRC: '' });
            }
        })
    }

    uploadFile(file, callback) {
        const { socket, instance } = this.props;
        let reader = new FileReader();
        reader.onload = ({ target: { result } }) => {
            socket.getRawSocket().emit('writeFile', `web.${instance}`, 'login-bg.png', result, () => {
                if (callback) callback('login-bg.png');
                this.readFile();
            });
        };
        reader.readAsArrayBuffer(file);
    }

    render() {
        const { classes, native, onChange } = this.props;
        const { imgSRC } = this.state;
        return <form className={classes.tab}>
            <div className={`${classes.column} ${classes.columnSettings}`}>
                <div>
                    <CustomInput
                        styleComponentBlock={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        component={<CustomInput
                            attr='loginBackgroundColorHelper'
                            type='color'
                            style={{ marginTop: -1, marginLeft: 10, minWidth: 60 }}
                            native={native}
                            onChange={async (e, value) => {
                                await onChange('loginBackgroundColorHelper', value);
                                await onChange('loginBackgroundColor', value);
                            }}
                            variant="outlined"
                            size="small"
                        />}
                        title='color'
                        attr='loginBackgroundColor'
                        style={{ marginTop: -1, marginBottom: 20 }}
                        native={native}
                        onChange={async (e, value) => {
                            await onChange('loginBackgroundColorHelper', value);
                            await onChange('loginBackgroundColor', value);
                        }}
                    />
                </div>
                <div>
                    <CustomCheckbox
                        title='background_image'
                        attr='loginBackgroundImage'
                        native={native}
                        onChange={onChange}
                    />
                </div>
                <div style={native['loginBackgroundImage'] ? { display: 'block' } : { display: 'none' }}>
                    <div>
                        <CustomButtonUpload
                            title="upload_image"
                            attr="files"
                            native={native}
                            onChange={(e) => this.uploadFile(e)}
                        />
                    </div>
                    <Dropzone
                        accept="image/*"
                        onDrop={acceptedFiles => this.uploadFile(acceptedFiles[0])}>
                        {({ getRootProps, getInputProps, isDragActive }) => (
                            <section>
                                <div
                                    className={`${classes.drop_zone} ${isDragActive ? classes.drop_zone_active : null}`}
                                    {...getRootProps()}>
                                    <input {...getInputProps()} />
                                    <p>{I18n.t('place_the_files_here')}</p>
                                    {imgSRC ? <img className={classes.imgStyle} src={imgSRC} alt="img" /> : null}
                                </div>
                            </section>
                        )}
                    </Dropzone>
                </div>
            </div>
        </form>;
    }
}

Background.propTypes = {
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

export default withStyles(styles)(Background);
