# Cyberpunk Viewer Integration
This project allows you to add viewer integration in a crowd control style to Cyberpunk 2077. This is designed to work with multiple platforms however currently there is only twitch summport.

# Dependencies
* [Cyberpunk Engine Tweaks](https://www.nexusmods.com/cyberpunk2077/mods/107)
* [Codeware](https://www.nexusmods.com/cyberpunk2077/mods/7780)

# Design
So their are two parts to this integration; the server and the cyberpunk tweaks mod. The server handles the platform integrations, it also acts as a bot for the platforms. The mod is what handles executing commands passed to it by the server. At first I thought using websockets for their communication would be best but when I tried to get it
to work, I ran into issues with lua's networking support inside cyberpunk engine tweaks. I then realized I could just pass information easily using a file as a queue between the client and server. Thus commands are written to a file in JSON format where the mod can read them and execute them.

# Setup
* First and formost, you need to install [NodeJS](https://nodejs.org/en) since it is the program that runs our effects server.

* Once its installed, open a command prompt and run
`npm install`

* When its complete, then run the following:
`cd ./CyberpunkEffectsServer && npm install`

* This will setup the dependencies of the server. 
* Next you need to install the cyberpunk dependencies above
* Once those are done, copy the folder CyberpunkViewerIntegration in \<Cyberpunk Folder\>\bin\x64\plugins\cyber_engine_tweaks\mods
* The final step is configuring the server. Navigate to CyberpunkEffectsServer\config and copy the config_example.json and rename it config.json
* Here you want to fill out the configuration for your twitch channel and for a bot account.
* In the channels section, you want to add your channel name and id, you can find your id using this [service](https://streamscharts.com/tools/convert-username).
  ```javascript
  "channels": {
        "your channel username": {
            "channelId": "result from service goes here",
            "channelName": "your channel username"
        }
    }
  ```
* Next you need to enter the path to where you installed the mod for cyberpunk
```javascript
"cyberpunkModPath": "\<Cyberpunk Folder\>\bin\x64\plugins\cyber_engine_tweaks\mods\CyberpunkViewerIntegration"
```
* To create a bot account, just simply create a new twitch account. Once its created, you need to generate [access tokens](https://twitchtokengenerator.com/) and add the bot as a mod to your stream.
```javascript
"identity": {
    "username": "bot username",
    "password": "bot access token"
},
"botUsername": "bot username"
```
> **Note:** Never share these credentials as they give too much access.
* next you want to do the same for you channel, when creating the tokens, create them for a custom scope as opposed to for a bot. It only needs channel:read:redemptions and channel:manage:redemptions
* Once you are done with the setup, now you can run the server, simply open a terminal in CyberpunkEffectsServer directory and run `npm run start`
* From here you can test things using the command line for the server, it accepts any commands that twitch chatter would send. You can view the commands in `CyberpunkEffectsServer\src\commands` or by typing commandList
* If there are any issues, all logs are logged to `app.log` in the server directory
* Twitch Channel point rewards are created automatically for you so please do not create them manually as the server needs to manage them. You can choose to edit them though if you want something different, you just can't change the command name

#List of effects
|                |Description                                        |Input                                                                                  |
|----------------|---------------------------------------------------|---------------------------------------------------------------------------------------|
|takemoney       |Steal money from the player                        |Viewer can enter custom amount                                                         |
|addmoney        |Give player money                                  |Viewer can enter custom amount                                                         |
|wanted          |Gives player a wanted level                        |Viewers can enter values between 1 and 5                                               |
|quickhack       |Allows viewer to execute a quickhack on the player |short-circuit, overheat, reboot-optics, disable-cyberware, slow-movement, weapon-glitch|
|statuseffect    |Applies status effect to player for 30 seconds     |frozen, bleeding, drunk                                                                |
|killplayer      |Kills the player                                   |N/A                                                                                    |
|upsidedown      |Inverts the players camera for 30 seconds          |N/A                                                                                    |
|doomvision      |Gives the player doom like vision for 30 seconds   |N/A                                                                                    |
|preyvision      |Whats its like to be prey for 30 seconds           |N/A                                                                                    |
|smashing        |Summons Smasher                                    |N/A                                                                                    |
|kurt            |Summons Kurt Hansen                                |N/A                                                                                    |
|slowdown        |Slows the player for 30 seconds                    |N/A                                                                                    |
|speedup         |Speeds up the player for 30 seconds                |N/A                                                                                    |
|carpocolypse    |Blows up all cars you can see                      |N/A                                                                                    |
|carsbepopin     |Pops the tires of all cars you can see             |N/A                                                                                    |
|dropweapons     |Throws the weapons from you hands                  |N/A                                                                                    |
|forceweapon     |Makes you use the best weapon in the game          |N/A                                                                                    |
|onehit          |Puts you at 1 hp                                   |N/A                                                                                    |
|heal            |Heals player to full                               |N/A                                                                                    |
|removeammo      |Removes all ammo                                   |N/A                                                                                    |
|infiniteammo    |Gives Infinite ammo for 30 seconds                 |N/A                                                                                    |

> All effects are queued and executed one at a time every 5 seconds. Any effect with a duration only executes one at a time. Queued effects will appear on the side of the screen
