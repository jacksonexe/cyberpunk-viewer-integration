--Created by Jackexe
Cron = require('External/Cron.lua')
Json = require('External/json.lua')

Enabled = true
CurrentIndex = 0
Timer = nil
HasInit = false
ChatMessages = nil

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

    for _, ent in pairs(Spawn.spawnedNPCs) do
        if ent.handle.IsNPC and ent.handle:IsNPC() then
            ent.handle:GetAttitudeAgent():SetAttitudeTowards(targetPuppet:GetAttitudeAgent(), EAIAttitude.AIA_Hostile)
        end
    end

    targetPuppet.isPlayerCompanionCached = false
    targetPuppet.isPlayerCompanionCachedTimeStamp = 0

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

if Enabled then
    registerForEvent("onInit", function()
        local file, err = io.open("currentLogs.log", 'w')
        if file then
            file:write(tostring(""))
            file:close()
        else
            print("error:", err)
        end
        Observe('PlayerPuppet', "OnTakeControl", function(player)
            if HasInit == false then
                HasInit = true
                local inkSystem = Game.GetInkSystem();
                local hudRoot = inkSystem:GetLayer("inkHUDLayer"):GetVirtualWindow();
                ChatMessages = inkText.new();
                ChatMessages:SetText("Latest Message:\n");
                ChatMessages:SetFontFamily("base\\gameplay\\gui\\fonts\\orbitron\\orbitron.inkfontfamily");
                ChatMessages:SetFontStyle("Bold");
                ChatMessages:SetFontSize(20);
                ChatMessages:SetTintColor(255, 255, 255, 255);
                ChatMessages:SetAnchor(inkEAnchor.CenterLeft);
                ChatMessages:SetAnchorPoint(-0.5, 0);
                --ChatMessages:Reparent(hudRoot);
                Cron.Every(10, { tick = 1 }, function(timer)
                    Timer = timer
                    if List.isEmpty(Queue) then
                        return
                    end
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
                        ChatMessages:SetText(finalMessages);
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
                            local amount = v["amount"]
                            local hack = ""
                            if amount == "overload" then
                                hack = "BaseStatusEffect.OverloadLevel4"
                            elseif amount == "overheat" then
                                hack = "BaseStatusEffect.OverheatLevel4"
                            end
                            local player = Game.GetPlayer()
                            local evt = gameeventsApplyStatusEffectEvent.new()
                            local staticData = TweakDB:GetRecord("AIQuickHackStatusEffect.HackBlind");
                            evt.instigatorEntityID = player:GetEntityID()
                            evt.isAppliedOnSpawn = true
                            evt.isNewApplication = true
                            evt.staticData = staticData
                            player['gamedataOnHackTargetEvent']()
                            Game['gameRPGManager::CreateStatModifier;gamedataStatTypegameStatModifierTypeFloat'](
                                'Quality', 'Additive', qualityValue)
                            StatusEffectHelper.ApplyStatusEffect(Game.GetPlayerObject(), hack, 0);
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
                                        if count < maxVehicles and (playerVehicle == nil or vc:GetEntityID() ~= playerVehicle:GetEntityID()) then
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
                            for i = 1, 10, 1 do
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
                            elseif amount == "blind" then
                                status = "BaseStatusEffect.Blind"
                            elseif amount == "bleeding" then
                                status = "BaseStatusEffect.Bleeding"
                            elseif amount == "drunk" then
                                status = "BaseStatusEffect.Drunk"
                                duration = 60
                            end
                            for i = 1, number, 1 do
                                StatusEffectHelper.ApplyStatusEffect(Game.GetPlayerObject(), status, 0);
                            end
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " made you get " .. amount .. ".")
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                for i = 1, number, 1 do
                                    StatusEffectHelper.RemoveStatusEffect(Game.GetPlayerObject(), status);
                                end
                            end)
                        elseif cType == "slowdown" then
                            local amount = v["amount"]
                            local duration = v["duration"]
                            Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", amount)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " slowed you down a bit.")
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", 1.0)
                            end)
                        elseif cType == "speedup" then
                            local amount = v["amount"]
                            local duration = v["duration"]
                            Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", amount)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " speed you up a bit.")
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                Game.GetTimeSystem():SetTimeDilationOnLocalPlayerZero("", 1.0)
                            end)
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
                            local fpp = Game.GetPlayer():GetFPPCameraComponent()
                            local curRot = fpp:GetLocalOrientation():ToEulerAngles()
                            curRot.roll = 180
                            fpp:SetLocalOrientation(curRot:ToQuat())
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                fpp:SetLocalOrientation(Quaternion.new(0.0, 0.0, 0.0, 1.0))
                            end)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " flipped the camera.")
                        elseif cType == "doomvision" then
                            local duration = v["duration"]
                            local fpp = Game.GetPlayer():GetFPPCameraComponent()
                            local defaultFOV = fpp:GetFOV()
                            fpp:SetFOV(120)
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                fpp:SetFOV(defaultFOV)
                            end)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you doom vision.")
                        elseif cType == "preyvision" then
                            local duration = v["duration"]
                            local fpp = Game.GetPlayer():GetFPPCameraComponent()
                            local defaultFOV = fpp:GetFOV()
                            fpp:SetFOV(2)
                            Cron.Every(duration, { tick = 1 }, function(timer)
                                Cron.Halt(timer);
                                fpp:SetFOV(defaultFOV)
                            end)
                            Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you prey vision.")
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
                            local im = Game.GetInventoryManager()
                            if (im:HasEquipmentStateFlag( gameEEquipmentManagerState.InfiniteAmmo) == false) then
                                im:AddEquipmentStateFlag(gameEEquipmentManagerState.InfiniteAmmo)
                                Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    im:RemoveEquipmentStateFlag(gameEEquipmentManagerState.InfiniteAmmo)
                                end)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " gave you infinite ammo.")
                            end
                        elseif cType == "invincible" then
                            local duration = v["duration"]
                            local player = Game.GetPlayer()
                            local gm = Game.GetGodModeSystem()
                            if (gm:HasGodMode(player:GetEntityID(), gameGodModeType.Immortal) == false) then
                                gm:AddGodMode(player:GetEntityID(), gameGodModeType.Immortal, 'JohnnyReplacerSequence')
                                Cron.Every(duration, { tick = 1 }, function(timer)
                                    Cron.Halt(timer);
                                    gm:RemoveGodMode(player:GetEntityID(), gameGodModeType.Immortal, 'JohnnyReplacerSequence')
                                end)
                                Game.GetPlayer():SetWarningMessage(v["username"] .. " made you immortal.")
                            end
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
        end)
    end)
    registerForEvent('onUpdate', function(delta)
        Cron.Update(delta)
        local lines = lines_from("currentLogs.log")
        for _, v in pairs(lines) do
            if (string.len(v) > 0) then
                List.pushright(Queue, json.decode(v))
            end
        end
    end)
end
