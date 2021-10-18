import React, {useEffect, useRef, useState} from "react";
import {
    IoCallOutline,
    IoCloseOutline,
    IoEllipsisVerticalOutline,
    IoExitOutline,
    IoMicOffOutline,
    IoMicOutline,
    IoPeopleOutline,
    IoSettingsOutline,
    IoVideocamOffOutline,
    IoVideocamOutline,
} from "react-icons/all";
import io from 'socket.io-client';
import UserThumb from "./../components/UserThumb";
import {
    useParams
} from "react-router-dom";

import faker from 'faker';

const styles = {
    page:{
        flexDirection:'column',
        display: 'flex',
        alignItems:"center",
        justifyContent:'center'
    },
    content:{
        flex: 1
    },
}
const debug = (incoming = true, message, id="") =>{
    id = id!==""?`${incoming?"from":"to"} ${id}`: "";
    console.info(incoming?"%c ↓":"%c ↑", `color: ${incoming?"green":"red"}`,  message, id );
}
const configuration = {iceServers: [
        {
            urls: 'turn:34.224.213.192:3478',
            username: 'xpeed',
            credential:'xpeed123'
        },
    ]};
///
function Room(props){
    const {room} = useParams();
    const [has_permission, setHasPermission] = useState(false);
    const [devices, setDevices] = useState(null);
    const [profile, setProfile] = useState(null);
    const [clients, _setClients] = useState([]);
    const clients_ref = useRef([]);
    const setClients = (data) =>{
        clients_ref.current = data;
        _setClients(data);
    }

    //
    const [is_open_settings, setOpenSettings] = useState(false);
    const [is_open_thumbs, setOpenThumbs] = useState(true);

    const [signaling, setSignaling] = useState(null);

    const [pin_user, setPinUser] = useState({});



    //references
    const pin_video_ref = useRef();

    //user function
    const upsertUser = (id, data)=>{
        if(clients_ref.current.find(ob=>ob.id===id)){
            setClients(clients_ref.current.map(ob=>{
                if(ob.id=== id)
                    ob = {...ob, ...data}
                return ob;
            }));
        } else {
            data.name = data.name??"";
            data.email = data.email??"email";
            data.id = data.id??id;
            setClients([...clients_ref.current, data]);
        }
    }
    const removeUser = (id) =>{
        setClients(clients_ref.current.filter(ob=>ob.id!==id));
    }

    //peer function
    const getPear = (id) =>{
        let user = clients_ref.current.find(ob=>ob.id===id) || {};
        return user.peer?user.peer :null;
    }

    //handler
    const handleToggleAudio = (muted) =>{
        muted = !profile.audio_muted;
        if(profile.stream) {
            const tracks = profile.stream.getAudioTracks();
            tracks[0].enabled = !muted;
        }

        setProfile({
            ...profile,
            audio_muted: muted
        });

        signaling.emit("audio_mute", muted);
    }
    const handleToggleVideo = (muted) =>{
        muted = !profile.video_muted;
        if(profile.stream) {
            const tracks = profile.stream.getVideoTracks();
            tracks[0].enabled = !muted;
        }
        setProfile({
            ...profile,
            video_muted: muted
        });
        signaling.emit("video_mute", muted);
    }
    const handlePinVideoChange = (user) =>{
        setPinUser(user);
    }
    const handleStreamChange = (user) =>{
        clients_ref.current.forEach(client=>{
            let pc = client.peer;
            let tracks = profile.stream.getTracks();
            let senders = pc.getSenders();
            senders.forEach(async sender=>{
                let track  = tracks.find(t=>t.kind===sender.track.kind);
                await sender.replaceTrack(track);
            });


        })
    };

    //peer
    let callBackOnJoin = async (id) => {
        // ICE candidate configuration.
        let pc = new RTCPeerConnection(configuration);
        //sending my stream
        profile.stream.getTracks().forEach((track) => pc.addTrack(track, profile.stream));
        pc.onicecandidate = (ev) => {
            if (!ev || !ev.candidate) return;
            signaling.emit("candidate", {
                to: id,
                candidate: ev.candidate
            });
            debug(false, "candidate", id);
        }
        //After peer connected
        pc.onnegotiationneeded = async (ev) => {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer);

            signaling.emit("offer", {
                to: id,
                offer: pc.localDescription
            });

            debug(false, "offer", id);

        }
        // After remote track media arrives, show it in remote video element.
        pc.ontrack = (event) => {
            upsertUser(id, {stream: event.streams[0]});
            debug(true, "stream", id);
        };
        debug(false, "offer", id);
        return pc;
    }
    let callBackOnOffer = async (id, offer) => {
        // ICE candidate configuration.
        let pc = new RTCPeerConnection(configuration);
        //sending my stream
        profile.stream.getTracks().forEach((track) => pc.addTrack(track, profile.stream));
        // Let the "negotiationneeded" event trigger offer generation.
        pc.onicecandidate = (ev) => {
            if (!ev || !ev.candidate) return;
            signaling.emit("candidate", {
                to: id,
                candidate: ev.candidate
            });
            debug(false, "candidate", id);
        }
        pc.ontrack = (event) => {
            // Don't set srcObject again if it is already set.
            upsertUser(id, {stream:event.streams[0]});
            debug(true, "stream", id);
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await pc.setLocalDescription(await pc.createAnswer());
        signaling.emit("answer", {
            to: id,
            answer: pc.localDescription
        });
        debug(false, "answer", id);
        return pc;
    }



    //init Permission
    const initPermission = async (c=0) =>{
        try{
            let stream = await navigator.mediaDevices.getUserMedia({audio:true, video:true});
            setHasPermission(true);
        } catch (ex){
            setHasPermission(false)
        }
    }
    //init Devices
    const initDevices = async () =>{
        try {
            let sources = {
                video: [],
                audio: []
            };
            navigator.mediaDevices.enumerateDevices().then( async  dvcs=>{
                for(let x=0; x<dvcs.length; x++) {
                    let info = dvcs[x];
                    let device = {info};
                    if (info.kind === "audioinput") {
                        //device.stream = await navigator.mediaDevices.getUserMedia({audio:{deviceId: {exact: info.deviceId}}});
                        sources.audio.push(device);
                    }
                    if (info.kind === "videoinput") {
                        //device.stream = await navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: info.deviceId}}});
                        sources.video.push(device);
                    }

                }

                setDevices(sources);
            });
        } catch (err) {
            alert(err.message);
        }
    }
    //upsertProfile
    const upsertProfile = async (update) => {
        let user = {};
        if(profile){
            user = profile;
        } else {
            user = {self: true};
        }
        user = {...user, ...update}
        let tracks = [];
        if(update.audio || update.video) {
            if(profile){profile.stream.getTracks().forEach(t=>t.stop());}
            let audio_tracks = (await navigator.mediaDevices.getUserMedia({audio: {deviceId: {exact: user.audio}}})).getTracks(); //devices.audio.find(i => i.info.deviceId === user.audio).stream.getAudioTracks();
            let video_tracks = (await navigator.mediaDevices.getUserMedia({video: {deviceId: {exact: user.video}}})).getTracks();//devices.video.find(i => i.info.deviceId === user.video).stream.getVideoTracks();

            tracks = tracks.concat(audio_tracks);
            tracks = tracks.concat(video_tracks);

            user.stream = new MediaStream(tracks);
            user.audio_muted = false;
            user.video_muted = false;
        }



        setProfile(user);

        if(!profile){
            setPinUser(user);
        }

    }
    //initSocket
    const initSocket = () =>{
        const query = {
            room_id: room,
            name : profile.name
        }
        let socket = io("https://xpd.herokuapp.com/conference", {
            query
        });
        setSignaling(socket);
    }
    //initSocketHandler
    const initSocketHandler = () =>{
        //adder handler
        signaling.on("join", async (event) => {
            if (!event.id || !event.name) return;
            let pc = await callBackOnJoin(event.id);
            let user = {
                id: event.id,
                name: event.name,
                peer: pc,
            }
            upsertUser(event.id, user);
            debug(true, "join", event.id);
        });
        signaling.on("candidate", async (event) => {
            let pc = getPear(event.from);
            if (!pc) return;
            await pc.addIceCandidate(new RTCIceCandidate(event.candidate));
            debug(true, "candidate", event.from);
        });
        signaling.on("answer", async (event) => {
            if (!event.from) return;
            let pc = getPear(event.from);
            if(!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(event.answer));
            debug(true, "answer", event.from);
        });

        //joiner
        signaling.on("offer", async (event) => {
            if (!event.from || !event.name) return;
            debug(true, "offer", event.from);
            let pc =  await callBackOnOffer(event.from, event.offer);
            let user = {
                id: event.from,
                name: event.name,
                peer: pc
            }
            upsertUser(event.from, user);
        });

        //both handler
        signaling.on("audio_mute", event=>{
            upsertUser(event.id, {audio_muted:  event.muted})
        })
        signaling.on("video_mute", event=>{
            upsertUser(event.id, {video_muted:  event.muted})
        })

        signaling.on("detached", async (id) => {
            removeUser(id);
        });
        signaling.on("connect", e => {
            console.log("connected");
        })
    }
    //component hooks
    useEffect(()=>{
        if(!has_permission){
            initPermission(0);
        } else {
            initDevices();
        }
    }, [has_permission]);

    useEffect(()=>{
        //init socket if profile exists
        if(!signaling && profile) {
            initSocket();
        }

        if(profile){
            handleStreamChange();
        }
    }, [profile]);
    useEffect(()=>{
        if(signaling && profile){
            initSocketHandler();
            signaling.emit("join");
        }
    },[signaling]);
    useEffect(()=>{
        if(pin_user && pin_user.stream && pin_video_ref.current){
            if(!Object.is(pin_video_ref.current.sercObject, pin_user.stream )) {
                pin_video_ref.current.srcObject = pin_user.stream;
                pin_video_ref.current.play();
                pin_video_ref.current.muted = true;
            }
        }
    }, [pin_user]);
    useEffect(()=>{
        if(!clients.length && profile){
            setPinUser(profile);
        }
    }, [clients])

    if(!has_permission){
        return <div id="page" className="room" style={{...styles.page,backgroundImage:'url(https://loremflickr.com/1080/720/black)'}}>
            <div className="login-form">
                <h3>Permission required</h3>
                <p>Need permission to continue.</p>
            </div>
        </div>
    }

    if(!devices){
        return <div id="page" className="room" style={{...styles.page,backgroundImage:'url(https://loremflickr.com/1080/720/black)'}}>
            <div className="login-form">
                <h3>Please wait..</h3>
                <p>While loading devices</p>
            </div>
        </div>
    }
    if(devices && !profile){
        return <>
            <div id="page" className="room" style={{...styles.page,backgroundImage:'url(https://loremflickr.com/1080/720/black)'}}>

                <form onSubmit={e=>{
                    e.preventDefault();
                    let fd = new FormData(e.target);
                    let name = fd.get("name");
                    let email = fd.get("email");
                    let audio = fd.get("audio");
                    let video = fd.get("video");

                    upsertProfile({name, email, audio, video});
                }} className="login-form">
                    <h3>Get Started</h3>
                    <div className="input-group">
                        <label>Name</label>
                        <input type="text" name="name" placeholder="please enter name" required defaultValue={faker.name.findName()}/>
                    </div>
                    <div className="input-group">
                        <label>Email</label>
                        <input type="email" name="email" placeholder="please enter email" required defaultValue={faker.internet.email()}/>
                    </div>

                    <div className="input-group">
                        <label>Select video source</label>
                        <select name="video">
                            {
                                devices.video.map(device=>{
                                    return <option  key={device.deviceId} value={device.info.deviceId}>{device.info.label}</option>
                                })
                            }
                        </select>

                    </div>

                    <div className="input-group">
                        <label>Select audio source</label>
                        <select name="audio">
                            {
                                devices.audio.map(device=>{
                                    return <option key={device.deviceId} value={device.info.deviceId}>{device.info.label}</option>
                                })
                            }
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Room</label>
                        <input disabled type="text" name="name" placeholder="please enter name" required defaultValue={room}/>
                    </div>

                    <div className="input-group">
                        <button type="submit">Enter</button>
                    </div>
                </form>
            </div>
        </>
    }

    return(
        <div id="page" className="room" style={styles.page}>
            <div style={styles.content} className="content">
                <div className="pin-user-details">
                    <span>{pin_user.name} {pin_user.self?"(you)":""}</span>
                    <i></i>
                </div>
                <video ref={pin_video_ref}/>


                <UserThumb {...profile} onPinVideo={handlePinVideoChange}/>

            </div>
            <div className="bottom">

                <div>
                    <IoCallOutline size={16}/>
                    <div>
                        <span className="title">You are in {room} room</span>
                        <span>{clients.length} together with you</span>
                    </div>
                </div>

                <button className={`${profile.audio_muted?'active':""}`} onClick={handleToggleAudio}>
                    {profile.audio_muted?<IoMicOffOutline size={20}/>:<IoMicOutline size={20}/>}
                </button>

                <button className={`${profile.video_muted?'active':""}`} onClick={handleToggleVideo}>
                    {profile.video_muted?<IoVideocamOffOutline size={20}/>:<IoVideocamOutline size={20}/>}
                </button>
                <button className={`${is_open_settings?'active':""}`}
                        onClick={e=>setOpenSettings(!is_open_settings)}>
                    {is_open_settings?<IoCloseOutline size={20}/>: <IoSettingsOutline size={20}/>}

                </button>

                <button style={{display: "none"}} className={`${is_open_thumbs?'active':""}`} onClick={e=>setOpenThumbs(!is_open_thumbs)}>
                    {is_open_thumbs?<IoCloseOutline size={20}/>: <IoPeopleOutline size={20}/>}
                </button>

                <button><IoEllipsisVerticalOutline size={20}/></button>

                <button className={`drop-btn`} onClick={e=>window.location.href="/"}><IoExitOutline size={20}/></button>
            </div>
            {
                is_open_settings&&
                <div className="settings-popup">
                    <div className="container">
                        <h3>Settings</h3>

                        <form onSubmit={e=>{
                            e.preventDefault();
                            let fd = new FormData(e.target);
                            let audio = fd.get("audio");
                            let video = fd.get("video");

                            upsertProfile({audio, video});
                            setOpenSettings(false);
                        }}>

                            <div className="input-group">
                                <label>Select video source</label>
                                <select name="video" defaultValue={profile.video}>
                                    {
                                        devices.video.map(device=>{
                                            return <option  key={device.deviceId} value={device.info.deviceId}>{device.info.label}</option>
                                        })
                                    }
                                </select>

                            </div>

                            <div className="input-group">
                                <label>Select audio source</label>
                                <select name="audio" defaultValue={profile.audio}>
                                    {
                                        devices.audio.map(device=>{
                                            return <option key={device.deviceId} value={device.info.deviceId}>{device.info.label}</option>
                                        })
                                    }
                                </select>
                            </div>

                            <div className="input-group">
                                <div>
                                    <button variant="danger" type="button" onClick={e=>setOpenSettings(false)}>Close</button>
                                    <button type="submit">Save</button>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            }
            {
                is_open_thumbs&&
                <div className="user-thumbs">
                    {
                        clients.map(user=><UserThumb {...user} key={user.id}  onPinVideo={handlePinVideoChange} />)
                    }
                </div>
            }
        </div>
    )
}
export default Room
