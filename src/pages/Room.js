import React, {useEffect, useReducer, useRef, useState} from "react";
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

import faker from 'faker';
import useReferredState from "../hookes/useReferredState";


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
    const room = "cool";
    const [clients, _setClients] = useState([]);
    const clients_ref = useRef([]);
    const setClients = (data) =>{
        clients_ref.current = data;
        _setClients(data);
    }

    const [is_open_settings, setOpenSettings] = useState(false);
    const [is_open_thumbs, setOpenThumbs] = useState(false);

    const [signaling, setSignaling] = useState(null);
    const [profile, setProfile] = useState(null);

    const [pin_user, serPinUser] = useState({});

    //references
    const pin_video_ref = useRef();

    //initProfile
    const initProfile = (name, email) => {
        const constraints = {audio: true, video: true};
        try {
            // Get local stream, show it in self-view, and add it to be sent.
            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
                let pro = {
                    id: null,
                    name: name,
                    email: email,
                    stream : stream,
                    self: true,
                }
                setProfile(pro);
            });
        } catch (err) {
            throw  err;
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
        setClients(clients_ref.current.filter(ob=>ob.id!=id));
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
        if(user.stream && pin_video_ref.current){
            if(!Object.is(pin_video_ref.current.sercObject, user.stream )) {
                pin_video_ref.current.srcObject = user.stream;
                pin_video_ref.current.play();
                pin_video_ref.current.muted = true;
            }
        }
    }

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



    //component hooks
    useEffect(()=>{
        //init socket if profile exists
        if(!signaling && profile) {
            initSocket();
        }

    }, [profile]);
    useEffect(()=>{
        if(signaling && profile){
            initSocketHandler();
            signaling.emit("join");
        }
    },[signaling]);

    if(!profile){
        return <>
            <div id="page" className="room" style={styles.page}>

                <form onSubmit={e=>{
                    e.preventDefault();
                    let fd = new FormData(e.target);
                    let name = fd.get("name");
                    let email = fd.get("email");

                    initProfile(name, email);
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
                        <button type="submit">Enter</button>
                    </div>
                </form>
            </div>

        </>
    }

    return(
        <div id="page" className="room" style={styles.page}>
            <div style={styles.content} className="content">

                <video ref={pin_video_ref}/>
                <audio/>


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
                <button className={`${is_open_settings?'active':""}`} onClick={e=>setOpenSettings(!is_open_settings)}><IoSettingsOutline size={20}/></button>

                <button className={`${is_open_thumbs?'active':""}`} onClick={e=>setOpenThumbs(!is_open_thumbs)}>
                    {is_open_thumbs?<IoCloseOutline size={20}/>: <IoPeopleOutline size={20}/>}
                </button>

                <button><IoEllipsisVerticalOutline size={20}/></button>

                <button className={`drop-btn`}><IoExitOutline size={20}/></button>
            </div>

            {
                is_open_settings&&
                <div className="settings-popup">
                    <div className="container">

                    </div>
                </div>
            }
            {
                is_open_thumbs&&
                <div className="user-thumbs">
                    <UserThumb {...profile} onPinVideo={handlePinVideoChange}/>
                    {
                        clients.map(user=><UserThumb {...user} key={user.id}  onPinVideo={handlePinVideoChange} />)
                    }
                </div>
            }
        </div>
    )
}
export default Room
