import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import { Dialog } from '@material-ui/core';
import PropTypes from 'prop-types';

const useStyles = makeStyles((theme) => ({
    modal_content_wrapper: {
        margin: '20px 0',
        padding: '0 35px',
        // background: '#f6f6f6',
        overflowX: 'hidden',
        minWidth: '320px'
    },
    modal_button_block: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '20px',
        flexFlow: 'wrap',
        borderTop: '1px solid silver'
    },
    modal_button_block_two: {
        justifyContent: 'space-around',
        flexFlow: 'wrap-reverse',
        '& button': {
            margin: '5px'
        }
    },
    modal_wrapper: {
        position: 'relative',
        '[class*="MuiPaper-root MuiDialog-paper MuiDialog-paperScrollPaper MuiDialog-paperWidthXl MuiPaper-elevation24 MuiPaper-rounded"]': {
            background: '#f6f6f6'
        }
    },
    close: {
        position: 'absolute',
        right: '8px',
        top: '6px',
        width: '32px',
        height: '32px',
        opacity: '0.9',
        cursor: 'pointer',
        transition: 'all 0.6s ease',
        '&:hover': {
            transform: 'rotate(90deg)'
        },
        '&:before': {
            position: 'absolute',
            left: '15px',
            content: '""',
            height: '33px',
            width: '4px',
            backgroundColor: '#ff4f4f',
            transform: 'rotate(45deg)'
        },
        '&:after': {
            position: 'absolute',
            left: '15px',
            content: '""',
            height: '33px',
            width: '4px',
            backgroundColor: '#ff4f4f',
            transform: 'rotate(-45deg)'
        },
    },
    '@media screen and (max-width: 460px)': {
        modal_content_wrapper: {
            minWidth: 'auto'
        }
    }

}));

const CustomModal = ({ open, close, children, titleButtom, titleButtom2, buttomClick }) => {
    const classes = useStyles();
    return (
        <Dialog
            open={open}
            maxWidth='xl'
            disableEscapeKeyDown={true}
            onClose={close}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            className={classes.modal_wrapper}
        >
            <div className={classes.modal_content_wrapper}>
                <div className={classes.close} onClick={close} />
                {children}
                <div className={`${classes.modal_button_block} ${titleButtom ? classes.modal_button_block_two : ''}`}>
                    {titleButtom && <Button onClick={buttomClick}>
                        {titleButtom}
                    </Button>}
                    {titleButtom2 && <Button onClick={close}>
                        {titleButtom2}
                    </Button>}
                </div>
            </div>
        </Dialog>
    );
}

CustomModal.defaultProps = {
    open: false,
    buttomClick: () => { },
    close: () => { }
};

CustomModal.propTypes = {
    open: PropTypes.bool,
    close: PropTypes.func,
    children: PropTypes.object,
    titleButtom: PropTypes.string,
    titleButtom2: PropTypes.string,
    buttomClick: PropTypes.func
};

export default CustomModal;