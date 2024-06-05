--Created by Jackexe
--Any code modification is allowed provided attribution is given
Cron = require('External/Cron.lua')
Json = require('External/json.lua')

Enabled = true
CurrentIndex = 0
Timer = nil
HasInit = false
TimerText = nil


List = {}
function List.new()
    return { first = 0, last = -1 }
end

function List.pushleft(list, value)
    local first = list.first - 1
    list.first = first
    list[first] = value
end

function List.pushright(list, value)
    local last = list.last + 1
    list.last = last
    list[last] = value
end

function List.popleft(list)
    local first = list.first
    if first > list.last then error("list is empty") end
    local value = list[first]
    list[first] = nil -- to allow garbage collection
    list.first = first + 1
    return value
end

function List.popright(list)
    local last = list.last
    if list.first > last then error("list is empty") end
    local value = list[last]
    list[last] = nil -- to allow garbage collection
    list.last = last - 1
    return value
end

function List.isEmpty(list)
    local last = list.last
    return list.first > last
end

function tablelength(T)
    local count = 0
    for _ in pairs(T) do count = count + 1 end
    return count
end

function List.length(list)
    return tablelength(list) - 2
end

function List.toArray(list)
    local arr = {}
    local count = 0
    for key, value in pairs(list) do
        if (key ~= "first" and key ~= "last") then
            arr[count] = value
            count = count + 1
        end
    end
    return arr
end

Queue = List.new()
LastMessageQueue = List.new()
QueueText = nil
QueueTextList = List.new()
QueueTimedTextList = List.new()

function file_exists(file)
    local f = io.open(file, "rb")
    if f then f:close() end
    return f ~= nil
end

-- get all lines from a file, returns an empty
-- list/table if the file does not exist
function lines_from(file)
    if not file_exists(file) then return {} end
    local lines = {}
    local count = 1
    for line in io.lines(file) do
        if (count >= CurrentIndex) then
            lines[count] = line
        end
        count = count + 1
    end
    CurrentIndex = count
    return lines
end

function TruncateString(str)
    local finalStr = str
    if (string.len(str) > 25) then
        finalStr = string.sub(str, 0, 25) .. "..."
    end
    return finalStr
end

function SetHostileRole(targetPuppet)
    local AIRole = AIRole.new()

    targetPuppet:GetAIControllerComponent():SetAIRole(AIRole)
    targetPuppet:GetAIControllerComponent():OnAttach()

    targetPuppet:GetAttitudeAgent():SetAttitudeGroup('Hostile')
    targetPuppet:GetAttitudeAgent():SetAttitudeTowards(Game.GetPlayer():GetAttitudeAgent(), EAIAttitude.AIA_Hostile)

    local sensePreset = TweakDBInterface.GetReactionPresetRecord(TweakDBID.new("ReactionPresets.Ganger_Aggressive"))
    targetPuppet.reactionComponent:SetReactionPreset(sensePreset)
    targetPuppet.reactionComponent:TriggerCombat(Game.GetPlayer())
end

function SetGodMode(entity, immortal)
    local entityID = entity:GetEntityID()
    local gs = Game.GetGodModeSystem()
    gs:ClearGodMode(entityID, CName.new("Default"))

    if immortal then
        gs:AddGodMode(entityID, gameGodModeType.Immortal, CName.new("Default"))
    else
        gs:AddGodMode(entityID, gameGodModeType.Mortal, CName.new("Default"))
    end
end

function GetDirection(angle)
    return Vector4.RotateAxis(Game.GetPlayer():GetWorldForward(), Vector4.new(0, 0, 1, 0), angle / 180.0 * Pi())
  end

function GetPosition(distance, angle)
  local pos = Game.GetPlayer():GetWorldPosition()
  local heading = GetDirection(angle)
  return Vector4.new(pos.x + (heading.x * distance), pos.y + (heading.y * distance), pos.z + heading.z, pos.w + heading.w)
end

function spawnEnemy(character)
    local player = Game.GetPlayer()
    local pos = player:GetWorldPosition()
    local heading = player:GetWorldForward()
    local offset = 5
    local angles = GetSingleton('Quaternion'):ToEulerAngles(player:GetWorldOrientation())
    local newPos = Vector4.new(pos.x + (heading.x * offset), pos.y + (heading.y * offset), pos.z - heading.z,
        pos.w - heading.w)
    local entitySpec = DynamicEntitySpec.new()
    entitySpec.recordID = TweakDBID.new(character)
    entitySpec.tags = { "SMASHER" }
    entitySpec.position = newPos
    entitySpec.orientation = angles
    local entityID = Game.GetDynamicEntitySystem():CreateEntity(entitySpec)
    Cron.Every(0.2, { tick = 1 }, function(timer)
        timer.tick = timer.tick + 1

        if timer.tick > 30 then
            Cron.Halt(timer)
        end

        local entity = Game.FindEntityByID(entityID)
        if entity then
            local handle = entity
            local currentRole = handle:GetAIControllerComponent():GetAIRole()
            SetGodMode(handle, false)
            if (currentRole ~= nil) then
                currentRole:OnRoleCleared(handle)
            end
            SetHostileRole(handle)
        end
    end)
end

function CreateTimer(maxTimertime)
    local elapsingTimer = maxTimertime
    TimerText:SetText(elapsingTimer)
    Cron.Every(1, function(timer)
        elapsingTimer = elapsingTimer - 1
        if(elapsingTimer < 0) then
            Cron.Halt(timer)
            TimerText:SetText("")
        else
            TimerText:SetText(elapsingTimer)
        end
    end)
end


function SpawnVehicle(vehicle, xOffset, yOffset, zOffset)
    local player = Game.GetPlayer()
    local pos = player:GetWorldPosition()
    local heading = player:GetWorldForward()
    local offset = 5
    local angles = GetSingleton('Quaternion'):ToEulerAngles(player:GetWorldOrientation())
    local newPos = Vector4.new(pos.x + (heading.x * offset) + xOffset, pos.y + (heading.y * offset) + yOffset,
        (pos.z - heading.z) + zOffset,
        pos.w - heading.w)
    local entitySpec = DynamicEntitySpec.new()
    entitySpec.recordID = vehicle
    entitySpec.tags = { "RAINING_CARS" }
    entitySpec.position = GetPosition(5.5, 0)
    entitySpec.orientation = angles
    local entityID = Game.GetDynamicEntitySystem():CreateEntity(entitySpec)

    local timerfunc = function(timer)
        local entity = Game.FindEntityByID(entityID)
        if entity then
            local handle = entity
            Game.GetTeleportationFacility():Teleport(handle, newPos, angles)
            Cron.Every(0.5, function(t2)
                if GameObject.IsVehicle(handle) then
                    handle:PhysicsWakeUp()
                    Cron.Every(0.5, function(t3)
                        local evt = gameDeathEvent.new()
                        evt.instigator = player
                        handle:GetVehicleComponent():OnDeath(evt)
                        Cron.Halt(t3)
                    end)
                end
                Cron.Halt(t2)
            end)
        end
        Cron.Halt(timer)
    end


    Cron.Every(0.5, timerfunc)
end

function SetQueueText() 
    local arr = List.toArray(QueueTextList)
    local arr2 = List.toArray(QueueTimedTextList)
    local finalText = ""
    for _, value in pairs(arr) do
        finalText = finalText .. value .. "\n"
    end
    if(List.length(QueueTimedTextList) > 0 ) then
        finalText = finalText .. "Queued Timers:\n"
        for _, value in pairs(arr2) do
            finalText = finalText .. "Queued " .. value["username"] .. " - " .. value["commandType"] .. "\n"
        end
    end
    if(string.len(finalText) > 0) then
        finalText = string.sub(finalText, 0, string.len(finalText) - 1)
    end
    QueueText:SetText(finalText)
end

function QueueUpcomingEffect(queuedItem)
    List.pushleft(QueueTextList, queuedItem)
    if(List.length(QueueTextList) > 5) then
        List.popright(QueueTextList)
    end
    SetQueueText()
end

function QueueUpcomingTimedEffect(queuedItem)
    List.pushleft(QueueTimedTextList, queuedItem)
    SetQueueText()
end

OutstandingTimers = List.new()
ActiveTimerTask = nil

function HandleTimerFinished()
    if(List.isEmpty(OutstandingTimers)) then
        ActiveTimerTask = nil
    else
        local timerTask = List.popleft(OutstandingTimers)
        List.popleft(QueueTimedTextList)
        SetQueueText()
        ActiveTimerTask = timerTask()
    end
end

CurrentFOV = nil
if Enabled then
    registerForEvent("onInit", function()
        local file, err = io.open("currentLogs.log", 'w')
        if file then
            file:write(tostring(""))
            file:close()
        else
            print("error:", err)
        end
        Observe("LocomotionEventsTransition", "OnExit", function(evt, stateContext, scriptInterface)
            if(CurrentFOV ~= nil) then
                local fpp = Game.GetPlayer():GetFPPCameraComponent()
                fpp:SetFOV(CurrentFOV)
            end
        end)
        Observe('PlayerPuppet', "OnTakeControl", function(player)
            if HasInit == false then
                HasInit = true
                local inkSystem = Game.GetInkSystem();
                local hudRoot = inkSystem:GetLayer("inkHUDLayer"):GetVirtualWindow();
                TimerText = inkText.new();
                TimerText:SetText("");
                TimerText:SetFontFamily("base\\gameplay\\gui\\fonts\\orbitron\\orbitron.inkfontfamily");
                TimerText:SetFontStyle("Bold");
                TimerText:SetFontSize(50);
                TimerText:SetTintColor(255, 255, 255, 255);
                TimerText:SetAnchor(inkEAnchor.TopLeft);
                TimerText:SetAnchorPoint(-0.5, -5.0);
                TimerText:Reparent(hudRoot);

                QueueText = inkText.new();
                QueueText:SetText("");
                QueueText:SetFontFamily("base\\gameplay\\gui\\fonts\\orbitron\\orbitron.inkfontfamily");
                QueueText:SetFontStyle("Bold");
                QueueText:SetFontSize(20);
                QueueText:SetTintColor(255, 255, 255, 255);
                QueueText:SetAnchor(inkEAnchor.CenterLeft);
                QueueText:SetAnchorPoint(-0.1, 0.1);
                QueueText:Reparent(hudRoot);

                Cron.Every(5, { tick = 1 }, function(timer)
                    Timer = timer
                    local blackboard = Game.GetBlackboardSystem():Get( Game.GetAllBlackboardDefs().UI_System );
		            local uiSystemBB = Game.GetAllBlackboardDefs().UI_System;
                    local inMenu =  blackboard:GetBool(uiSystemBB.IsInMenu)
                    local bds = Game.GetScriptableSystemsContainer():Get( 'BraindanceSystem' ) 
                    if List.isEmpty(Queue) or (bds ~= nil and bds.isInBraindance) or inMenu then
                        return
                    end
                    if not List.isEmpty(QueueTextList) then
                        List.popright(QueueTextList)
                    end
                    SetQueueText()
                    local v = List.popleft(Queue)
                    local cType = v["commandType"]
                    if cType == "MESSAGE" then
                        if List.length(LastMessageQueue) >= 3 then
                            List.popleft(LastMessageQueue)
                        end
                        List.pushright(LastMessageQueue, v)
                        local finalMessages = "Latest Message:"
                        local arr = List.toArray(LastMessageQueue)
                        for _, value in pairs(arr) do
                            finalMessages = finalMessages .. "\n\n\t" .. TruncateString(value)
                        end
                        --ChatMessages:SetText(finalMessages);
                        Game.GetPlayer():SetWarningMessage(v)
                    else
                        if cType == "takemoney" then
                            local amount = v["amount"]
                            local ts = Game.GetTransactionSystem()
                            ts:RemoveItemByTDBID(player, "Items.money", amount)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " took " .. amount .. " eddies.")
                        elseif cType == "givemoney" then
                            local amount = v["amount"]
                            Game.AddToInventory("Items.money", amount)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you " .. amount .. " eddies.")
                        elseif cType == "wanted" then
                            local amount = v["amount"]
                            local heat = EPreventionHeatStage.Heat_0
                            if amount == 1 then
                                heat = EPreventionHeatStage.Heat_1
                            elseif amount == 2 then
                                heat = EPreventionHeatStage.Heat_2
                            elseif amount == 3 then
                                heat = EPreventionHeatStage.Heat_3
                            elseif amount == 4 then
                                heat = EPreventionHeatStage.Heat_4
                            elseif amount >= 5 then
                                heat = EPreventionHeatStage.Heat_5
                            end
                            local prevention = GetSingleton("PreventionSystem")
                            local request = PreventionConsoleInstructionRequest.new()
                            print(heat)
                            if (not prevention:IsChasingPlayer()) then
                                request.instruction = EPreventionSystemInstruction.Active;
                                request.heatStage = heat;
                                prevention.QueueRequest(request);
                                Game.GetPlayer():SetWarningMessage(v["username"] ..
                                    " sent the cops at level " .. amount .. ".")
                            end
                        elseif cType == "quickhack" then
                            local amount = string.lower(v["amount"])
                            local hack = ""
                            if amount == "short-circuit" then
                                hack = "NetrunnerActions.CoverHackOverload_inline4"
                            elseif amount == "overheat" then
                                hack = "NetrunnerActions.HackOverheat_inline4"
                            elseif amount == "reboot-optics" then
                                hack = "NetrunnerActions.HackBlind_inline5"
                            elseif amount == "disable-cyberware" then
                                hack = "NetrunnerActions.HackCyberware_inline5"
                            elseif amount == "cripple-movement" or amount == "slow-movement" then
                                hack = "NetrunnerActions.HackLocomotion_inline5"
                            elseif amount == "weapon-glitch" then
                                hack = "NetrunnerActions.HackWeaponMalfunction_inline5"
                            end
                            local player = Game.GetPlayer()
                            local evt = HackTargetEvent.new()
                            local record = TweakDBInterface.GetAISubActionQuickHackRecord(hack)
                            evt.targetID = player:GetEntityID();
                            evt.netrunnerID = player:GetEntityID();
                            evt.objectRecord = record:ActionResult();
                            evt.settings.isRevealPositionAction = true
                            player:QueueEvent( evt );
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " hacked you with " .. amount .. ".")
                        elseif cType == "killplayer" then
                            Game.GetPlayer():OnDied()
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " killed you.")
                        elseif cType == "onehit" then
                            local sp = Game.GetStatPoolsSystem()
                            local player = Game.GetPlayer()
                            local currentHealth = sp:ToPoints(player:GetEntityID(), gamedataStatPoolType.Health,
                            sp:GetStatPoolValue(
                                player:GetEntityID(), gamedataStatPoolType.Health, true))
                            print(currentHealth)
                            GameInstance.GetStatPoolsSystem():RequestChangingStatPoolValue(
                                player:GetEntityID(), gamedataStatPoolType.Health, -(currentHealth - 1), nil, false, false);
                            player:SetWarningMessage(v["username"] .. " put you in one hit mode.")
                        elseif cType == "carpocolypse" then
                            local player = Game.GetPlayer()
                            local playerVehicle = player:GetMountedVehicle()
                            local ts = Game.GetTargetingSystem()
                            local searchQuery = Game["TSQ_ALL;"]()
                            searchQuery.maxDistance = 500
                            local _, parts = ts:GetTargetParts(player, searchQuery)
                            local count = 0
                            local maxVehicles = 5
                            if parts ~= nil then
                                for _, entities in ipairs(parts) do
                                    local target = entities:GetComponent():GetEntity()
                                    if GameObject.IsVehicle(target) then
                                        
                                        if count < maxVehicles then
                                            local evt = gameDeathEvent.new()
                                            evt.instigator = player
                                            target:GetVehicleComponent():OnDeath(evt)
                                            count = count + 1
                                            if count >= maxVehicles then
                                                break
                                            end
                                        end
                                    end
                                end
                                if count > 0 then
                                    player:SetWarningMessage(v["username"] .. " caused a " .. count .. " car pile up.")
                                end
                            end
                        elseif cType == "carsbepopin" then
                            local player = Game.GetPlayer()
                            local playerVehicle = player:GetMountedVehicle()
                            local ts = Game.GetTargetingSystem()
                            local searchQuery = Game["TSQ_ALL;"]()
                            local _, parts = ts:GetTargetParts(player, searchQuery)
                            if parts ~= nil then
                                for _, entities in ipairs(parts) do
                                    local target = entities:GetComponent():GetEntity()
                                    if GameObject.IsVehicle(target) then
                                        for i = 1, 4, 1 do
                                            target:ToggleBrokenTire(i, true)
                                        end
                                    end
                                end
                            end
                            if playerVehicle ~= nil then
                                for i = 1, 4, 1 do
                                    playerVehicle:ToggleBrokenTire(i, true)
                                end
                            end
                            player:SetWarningMessage(v["username"] .. " popped some tires.")
                        elseif cType == "tankrain" then
                            for i = 1, 3, 1 do
                                SpawnVehicle("Vehicle.v_standard3_militech_hellhound_player", math.random(1, 5),
                                    math.random(1, 5), math.random(2, 50))
                            end
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " made it rain.")
                        elseif cType == "statuseffect" then
                            local amount = v["amount"]
                            local duration = v["duration"]
                            local status = ""
                            local number = 4
                            if amount == "frozen" then
                                status = "BaseStatusEffect.PlayerMovementLocked"
                            elseif amount == "bleeding" then
                                status = "BaseStatusEffect.Bleeding"
                            elseif amount == "drunk" then
                                status = "BaseStatusEffect.Drunk"
                                duration = 60
                            end
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                for i = 1, number, 1 do
                                    StatusEffectHelper.ApplyStatusEffect(Game.GetPlayerObject(), status, 0);
                                end
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " made you get " .. amount .. ".")
                                CreateTimer(duration)
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    for i = 1, number, 1 do
                                        StatusEffectHelper.RemoveStatusEffect(Game.GetPlayerObject(), status);
                                    end
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "slowdown" then
                            local amount = v["amount"]
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", amount)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " slowed you down a bit.")
                                CreateTimer(duration)
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", 1.0)
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "speedup" then
                            local amount = v["amount"]
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", amount)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " speed you up a bit.")
                                CreateTimer(duration)
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", 1.0)
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "teleport" then
                            local amount = v["amount"]
                            Game.TeleportPlayerToPosition(amount.x, amount.y, amount.z)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " teleported you somewhere.")
                        elseif cType == "novas" then
                            --TBD
                        elseif cType == "dropweapons" then
                            local player = Game.GetPlayer()
                            local ssc = Game.GetScriptableSystemsContainer()
                            local lm = Game.GetLootManager()
                            local ts = Game.GetTransactionSystem()
                            local es = ssc:Get(CName.new('EquipmentSystem'))
                            local espd = es:GetPlayerData(player)
                            espd['GetItemInEquipSlot2'] = espd['GetItemInEquipSlot;gamedataEquipmentAreaInt32']
                            local slots = {
                                Weapon = 3
                            }
                            local pos = player:GetWorldPosition()
                            local heading = player:GetWorldForward()
                            local offset = 5
                            local angles = GetSingleton('Quaternion'):ToEulerAngles(player:GetWorldOrientation())
                            local newPos = Vector4.new(pos.x + (heading.x * offset), pos.y + (heading.y * offset),
                                pos.z - heading.z,
                                pos.w - heading.w)
                            for k, v in pairs(slots) do
                                for i = 1, v do
                                    local itemid = espd:GetItemInEquipSlot2(k, i - 1)
                                    if itemid.id.hash ~= 0 then
                                        lm:SpawnThrowableItemDrop(player, itemid, newPos, angles,
                                            gameprojectileParabolicTrajectoryParams.GetAccelVelParabolicParams(
                                                Vector4.new(-(math.random(1, 50000) * 0.001),
                                                    -(math.random(1, 50000) * 0.001), -(math.random(1, 50000) * 0.001),
                                                    0.0),
                                                math.random(1, 50000) * 0.001))
                                        --ts:RemoveItemFromAnySlot(player, itemid, false, true)
                                        ts:RemoveItem(player, itemid, 1)
                                    end
                                end
                            end
                        elseif cType == "forceweapon" then
                            local ts = Game.GetTransactionSystem()
                            Game.AddToInventory("Items.Preset_Base_Slaughtomatic", 1)
                            local player = Game.GetPlayer()
                            local itemdata = ts:GetItemDataByTDBID(player, "Items.Preset_Base_Slaughtomatic")
                            local drawItemRequest
                            local equipRequest
                            local ps = Game.GetPlayerSystem()
                            local player = ps:GetLocalPlayerControlledGameObject()
                            local itemID = itemdata:GetID()
                            local record = TweakDB:GetRecord("Items.Preset_Base_Slaughtomatic");
                            equipRequest = EquipRequest.new();
                            equipRequest.itemID = itemID;
                            equipRequest.owner = player;
                            equipRequest.addToInventory = true;
                            local ssc = Game.GetScriptableSystemsContainer()
                            local es = ssc:Get(CName.new('EquipmentSystem'))
                            es:QueueRequest(equipRequest);
                            drawItemRequest = DrawItemRequest.new();
                            drawItemRequest.owner = player;
                            drawItemRequest.itemID = itemID;
                            es:QueueRequest(drawItemRequest);
                            player:SetWarningMessage(v["username"] .. " gave you a shiny new gun.")
                        elseif cType == "upsidedown" then
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                local fpp = Game.GetPlayer():GetFPPCameraComponent()
                                local curRot = fpp:GetLocalOrientation():ToEulerAngles()
                                curRot.roll = 180
                                fpp:SetLocalOrientation(curRot:ToQuat())
                                CreateTimer(duration)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " flipped the camera.")
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    fpp:SetLocalOrientation(Quaternion.new(0.0, 0.0, 0.0, 1.0))
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "doomvision" then
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                local fpp = Game.GetPlayer():GetFPPCameraComponent()
                                local defaultFOV = fpp:GetFOV()
                                CurrentFOV = 120
                                fpp:SetFOV(CurrentFOV)
                                CreateTimer(duration)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you doom vision.")
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    CurrentFOV = nil
                                    
                                    fpp:SetFOV(defaultFOV)
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "preyvision" then
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                local fpp = Game.GetPlayer():GetFPPCameraComponent()
                                local defaultFOV = fpp:GetFOV()
                                CurrentFOV = 2
                                fpp:SetFOV(CurrentFOV)
                                CreateTimer(duration)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you prey vision.")
                                return Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    CurrentFOV = nil
                                    fpp:SetFOV(defaultFOV)
                                    HandleTimerFinished()
                                end)
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "smashing" then
                            spawnEnemy("Character.main_boss_adam_smasher")
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " summoned Smasher.")
                        elseif cType == "chimera" then
                            spawnEnemy("Character.q302_militech_chimera")
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " summoned the chimera.")
                        elseif cType == "kurt" then
                            spawnEnemy("Character.kurtz")
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " summoned Kurt.")
                        elseif cType == "heal" then
                            local maxHealth = Game.GetStatPoolsSystem():GetStatPoolMaxPointValue( Game.GetPlayer():GetEntityID(), gamedataStatPoolType.Health );
                            GameInstance.GetStatPoolsSystem():RequestChangingStatPoolValue(
                                Game.GetPlayer():GetEntityID(), gamedataStatPoolType.Health, maxHealth, nil, true, false);
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " healed you.")
                        elseif cType == "refillammo" then
                            local ts = Game.GetTransactionSystem()
                            local player = Game.GetPlayer()
                            
                            ts:GiveItem(player, ItemID.FromTDBID("Ammo.HandgunAmmo"), 9999)
                            ts:GiveItem(player, ItemID.FromTDBID("Ammo.RifleAmmo"), 9999)
                            ts:GiveItem(player, ItemID.FromTDBID("Ammo.ShotgunAmmo"), 9999)
                            ts:GiveItem(player, ItemID.FromTDBID("Ammo.SniperRifleAmmo"), 9999)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " refilled your ammo.")
                        elseif cType == "removeammo" then
                            local ts = Game.GetTransactionSystem()
                            local player = Game.GetPlayer()
                            ts:RemoveItemByTDBID(player, "Ammo.HandgunAmmo", 99999)
                            ts:RemoveItemByTDBID(player, "Ammo.RifleAmmo", 99999)
                            ts:RemoveItemByTDBID(player, "Ammo.ShotgunAmmo", 99999)
                            ts:RemoveItemByTDBID(player, "Ammo.SniperRifleAmmo", 99999)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " took your ammo.")
                        elseif cType == "infiniteammo" then
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                local im = Game.GetInventoryManager()
                                if (im:HasEquipmentStateFlag( gameEEquipmentManagerState.InfiniteAmmo) == false) then
                                    im:AddEquipmentStateFlag(gameEEquipmentManagerState.InfiniteAmmo)
                                    CreateTimer(duration)
                                    Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you infinite ammo.")
                                    return Cron.Every(duration, { tick = 1 }, function(timer)
                                        Cron.Halt(timer);
                                        im:RemoveEquipmentStateFlag(gameEEquipmentManagerState.InfiniteAmmo)
                                        HandleTimerFinished()
                                    end)
                                end
                                return nil
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        elseif cType == "invincible" then
                            local duration = v["duration"]
                            QueueUpcomingTimedEffect(v)
                            local timerTask = function()
                                local player = Game.GetPlayer()
                                local gm = Game.GetGodModeSystem()
                                if (gm:HasGodMode(player:GetEntityID(), gameGodModeType.Immortal) == false) then
                                    gm:AddGodMode(player:GetEntityID(), gameGodModeType.Immortal, 'JohnnyReplacerSequence')
                                    CreateTimer(duration)
                                    Game.GetPlayer():SetWarningMessage(v["username"] .. " made you immortal.")
                                    return Cron.Every(duration, { tick = 1 }, function(timer)
                                        Cron.Halt(timer);
                                        gm:RemoveGodMode(player:GetEntityID(), gameGodModeType.Immortal, 'JohnnyReplacerSequence')
                                        HandleTimerFinished()
                                    end)
                                end
                                return nil
                            end
                            List.pushright(OutstandingTimers, timerTask)
                        end
                        if(List.length(OutstandingTimers) == 1 and ActiveTimerTask == nil) then
                            HandleTimerFinished()
                        end
                    end
                end)
            end
        end)
        Observe("PlayerPuppet", "OnDetach", function(player)
            HasInit = false
            if Timer ~= nil then
                Cron.Halt(Timer)
            end
            if(ActiveTimerTask ~= nil) then
                Cron.Halt(ActiveTimerTask)
            end
            OutstandingTimers = List.new()
            QueueTextList = List.new()
            QueueTimedTextList = List.new()
        end)
    end)
    registerForEvent('onUpdate', function(delta)
        Cron.Update(delta)
        local lines = lines_from("currentLogs.log")
        for _, v in pairs(lines) do
            if (string.len(v) > 0) then
                local effectConfig = json.decode(v)
                QueueUpcomingEffect("Queued " .. effectConfig["username"] .. " - " .. effectConfig["commandType"])
                List.pushright(Queue, effectConfig)
            end
        end
    end)
end
