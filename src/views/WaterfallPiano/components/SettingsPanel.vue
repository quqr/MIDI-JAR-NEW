<template>
  <div class="p-4 space-y-3">
    <!-- 主题系统 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.theme')"
      :default-open="true"
    >
      <!-- 主题预设选择 -->
      <div class="form-control w-full mb-2">
        <label class="label py-1">
          <span class="label-text text-xs">{{
            t("waterfallPiano.visualTheme")
          }}</span>
        </label>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="theme in availableThemes"
            :key="theme.id"
            class="btn btn-sm justify-start text-left"
            :class="
              store.settings.theme.current === theme.id
                ? 'btn-primary'
                : 'btn-ghost'
            "
            @click="applyTheme(theme.id)"
          >
            {{ t(theme.labelKey) }}
          </button>
        </div>
      </div>

      <!-- 粒子预设选择 -->
      <SettingsSelect
        :model-value="store.settings.particles.particlePreset"
        :label="t('waterfallPiano.particlePreset')"
        :options="particlePresetOptions"
        @update:model-value="applyParticlePreset($event as ParticlePresetId)"
      />

      <!-- 风格参数滑块 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.styleParameters") }}
      </div>
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.ambianceIntensity"
        :label="t('waterfallPiano.styleParams.ambianceIntensity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('ambianceIntensity', $event)"
      />
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.particleDensity"
        :label="t('waterfallPiano.styleParams.particleDensity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('particleDensity', $event)"
      />
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.burstForce"
        :label="t('waterfallPiano.styleParams.burstForce')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('burstForce', $event)"
      />
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.floatSense"
        :label="t('waterfallPiano.styleParams.floatSense')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('floatSense', $event)"
      />
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.glowIntensity"
        :label="t('waterfallPiano.styleParams.glowIntensity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('glowIntensity', $event)"
      />
      <SettingsRange
        :model-value="store.settings.theme.styleParameters.colorTemperature"
        :label="t('waterfallPiano.styleParams.colorTemperature')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="updateStyleParam('colorTemperature', $event)"
      />

      <!-- 导入/导出 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.themeImportExport") }}
      </div>
      <div class="flex gap-2">
        <button class="btn btn-xs btn-ghost flex-1" @click="exportTheme">
          {{ t("waterfallPiano.exportTheme") }}
        </button>
        <button class="btn btn-xs btn-ghost flex-1" @click="importTheme">
          {{ t("waterfallPiano.importTheme") }}
        </button>
      </div>
      <input
        ref="themeFileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="onThemeFileSelected"
      />
    </SettingsCollapse>

    <!-- 视觉设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.visual')"
      :default-open="true"
    >
      <SettingsSelect
        :model-value="store.settings.particles.style"
        :label="t('waterfallPiano.visualStyle')"
        :options="visualStyleOptions"
        @update:model-value="store.updateSetting('particles', 'style', $event)"
      />
      <SettingsSelect
        :model-value="store.settings.particles.colorScheme"
        :label="t('waterfallPiano.colorScheme')"
        :options="colorSchemeOptions"
        @update:model-value="
          store.updateSetting('particles', 'colorScheme', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.speed"
        :label="t('waterfallPiano.realtimeSpeed')"
        :min="0.5"
        :max="8"
        :step="0.1"
        @update:model-value="store.updateSetting('particles', 'speed', $event)"
      />
      <SettingsRange
        :model-value="store.settings.particles.lookAhead"
        :label="t('waterfallPiano.lookAhead')"
        :min="1"
        :max="6"
        :step="0.5"
        @update:model-value="
          store.updateSetting('particles', 'lookAhead', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.opacity"
        :label="t('waterfallPiano.particleOpacity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('particles', 'opacity', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.cornerRadius"
        :label="t('waterfallPiano.cornerRadius')"
        :min="0"
        :max="20"
        :step="1"
        @update:model-value="
          store.updateSetting('particles', 'cornerRadius', $event)
        "
      />

      <!-- 命中线设置 -->
      <SettingsToggle
        :model-value="store.settings.particles.hitLine.visible"
        :label="t('waterfallPiano.hitLineVisible')"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            visible: $event,
          })
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.particles.hitLine.color"
        :label="t('waterfallPiano.hitLineColor')"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            color: $event,
          })
        "
      />
      <SettingsToggle
        :model-value="store.settings.particles.hitLine.glow"
        :label="t('waterfallPiano.hitLineGlow')"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            glow: $event,
          })
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.hitLine.thickness"
        :label="t('waterfallPiano.hitLineThickness')"
        :min="1"
        :max="10"
        :step="1"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            thickness: $event,
          })
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.hitLine.glowRadius"
        :label="t('waterfallPiano.hitLineGlowRadius')"
        :min="0"
        :max="50"
        :step="1"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            glowRadius: $event,
          })
        "
      />
      <SettingsRange
        :model-value="store.settings.particles.hitLine.glowIntensity"
        :label="t('waterfallPiano.hitLineGlowIntensity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            glowIntensity: $event,
          })
        "
      />
      <SettingsSelect
        :model-value="store.settings.particles.hitLine.style"
        :label="t('waterfallPiano.hitLineStyle')"
        :options="hitLineStyleOptions"
        @update:model-value="
          store.updateSetting('particles', 'hitLine', {
            ...store.settings.particles.hitLine,
            style: $event,
          })
        "
      />

      <!-- 音符块设置 -->
      <SettingsToggle
        :model-value="store.settings.particles.noteBlock.borderEnabled"
        :label="t('waterfallPiano.noteBlockBorder')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            borderEnabled: $event,
          })
        "
      />
      <SettingsColorPicker
        v-if="store.settings.particles.noteBlock.borderEnabled"
        :model-value="store.settings.particles.noteBlock.borderColor"
        :label="t('waterfallPiano.noteBlockBorderColor')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            borderColor: $event,
          })
        "
      />
      <SettingsRange
        v-if="store.settings.particles.noteBlock.borderEnabled"
        :model-value="store.settings.particles.noteBlock.borderWidth"
        :label="t('waterfallPiano.noteBlockBorderWidth')"
        :min="1"
        :max="5"
        :step="0.5"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            borderWidth: $event,
          })
        "
      />
      <SettingsToggle
        :model-value="store.settings.particles.noteBlock.gradientEnabled"
        :label="t('waterfallPiano.noteBlockGradient')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            gradientEnabled: $event,
          })
        "
      />
      <SettingsToggle
        :model-value="store.settings.particles.noteBlock.highlightEnabled"
        :label="t('waterfallPiano.noteBlockHighlight')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            highlightEnabled: $event,
          })
        "
      />
      <SettingsRange
        v-if="store.settings.particles.noteBlock.highlightEnabled"
        :model-value="store.settings.particles.noteBlock.highlightOpacity"
        :label="t('waterfallPiano.noteBlockHighlightOpacity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            highlightOpacity: $event,
          })
        "
      />
      <SettingsToggle
        :model-value="store.settings.particles.noteBlock.fadeIn"
        :label="t('waterfallPiano.noteBlockFadeIn')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            fadeIn: $event,
          })
        "
      />
      <SettingsToggle
        :model-value="store.settings.particles.noteBlock.fadeOut"
        :label="t('waterfallPiano.noteBlockFadeOut')"
        @update:model-value="
          store.updateSetting('particles', 'noteBlock', {
            ...store.settings.particles.noteBlock,
            fadeOut: $event,
          })
        "
      />

      <!-- 粒子/混合模式额外设置 -->
      <template v-if="store.settings.particles.style !== 'blocks'">
        <SettingsSelect
          :model-value="store.settings.particles.shape"
          :label="t('waterfallPiano.particleShape')"
          :options="particleShapeOptions"
          @update:model-value="
            store.updateSetting('particles', 'shape', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.size"
          :label="t('waterfallPiano.particleSize')"
          :min="2"
          :max="30"
          :step="1"
          @update:model-value="store.updateSetting('particles', 'size', $event)"
        />
        <SettingsRange
          :model-value="store.settings.particles.density"
          :label="t('waterfallPiano.particleDensity')"
          :min="1"
          :max="20"
          :step="1"
          @update:model-value="
            store.updateSetting('particles', 'density', $event)
          "
        />
        <SettingsToggle
          :model-value="store.settings.particles.trail"
          :label="t('waterfallPiano.trailEffect')"
          @update:model-value="
            store.updateSetting('particles', 'trail', $event)
          "
        />

        <!-- 拖尾粒子详细参数 -->
        <SettingsRange
          :model-value="store.settings.particles.trailParticle.size"
          :label="t('waterfallPiano.trailParticleSize')"
          :min="1"
          :max="15"
          :step="1"
          @update:model-value="
            store.updateSetting('particles', 'trailParticle', {
              ...store.settings.particles.trailParticle,
              size: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.trailParticle.colorDecay"
          :label="t('waterfallPiano.trailColorDecay')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('particles', 'trailParticle', {
              ...store.settings.particles.trailParticle,
              colorDecay: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.trailParticle.spreadAngle"
          :label="t('waterfallPiano.trailSpreadAngle')"
          :min="0"
          :max="180"
          :step="5"
          @update:model-value="
            store.updateSetting('particles', 'trailParticle', {
              ...store.settings.particles.trailParticle,
              spreadAngle: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.trailParticle.lifetime"
          :label="t('waterfallPiano.trailLifetime')"
          :min="5"
          :max="100"
          :step="5"
          @update:model-value="
            store.updateSetting('particles', 'trailParticle', {
              ...store.settings.particles.trailParticle,
              lifetime: $event,
            })
          "
        />

        <!-- 命中爆炸粒子参数 -->
        <SettingsRange
          :model-value="store.settings.particles.hitParticle.count"
          :label="t('waterfallPiano.hitParticleCount')"
          :min="0"
          :max="30"
          :step="1"
          @update:model-value="
            store.updateSetting('particles', 'hitParticle', {
              ...store.settings.particles.hitParticle,
              count: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.hitParticle.speed"
          :label="t('waterfallPiano.hitParticleSpeed')"
          :min="0.5"
          :max="10"
          :step="0.5"
          @update:model-value="
            store.updateSetting('particles', 'hitParticle', {
              ...store.settings.particles.hitParticle,
              speed: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.hitParticle.lifetime"
          :label="t('waterfallPiano.hitParticleLifetime')"
          :min="5"
          :max="80"
          :step="5"
          @update:model-value="
            store.updateSetting('particles', 'hitParticle', {
              ...store.settings.particles.hitParticle,
              lifetime: $event,
            })
          "
        />

        <!-- 粒子物理效果 -->
        <SettingsRange
          :model-value="store.settings.particles.physics.gravity"
          :label="t('waterfallPiano.particleGravity')"
          :min="-5"
          :max="5"
          :step="0.1"
          @update:model-value="
            store.updateSetting('particles', 'physics', {
              ...store.settings.particles.physics,
              gravity: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.physics.windX"
          :label="t('waterfallPiano.particleWindX')"
          :min="-5"
          :max="5"
          :step="0.1"
          @update:model-value="
            store.updateSetting('particles', 'physics', {
              ...store.settings.particles.physics,
              windX: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.particles.physics.windY"
          :label="t('waterfallPiano.particleWindY')"
          :min="-5"
          :max="5"
          :step="0.1"
          @update:model-value="
            store.updateSetting('particles', 'physics', {
              ...store.settings.particles.physics,
              windY: $event,
            })
          "
        />
      </template>

      <!-- 分组重置 -->
      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('particles')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 键盘设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.keyboard')"
      :default-open="false"
    >
      <SettingsToggle
        :model-value="store.settings.keyboard.visible"
        :label="t('waterfallPiano.showKeyboard')"
        @update:model-value="store.updateSetting('keyboard', 'visible', $event)"
      />
      <SettingsRange
        :model-value="store.settings.keyboard.heightRatio"
        :label="t('waterfallPiano.keyboardHeightRatio')"
        :min="0.1"
        :max="0.5"
        :step="0.01"
        @update:model-value="
          store.updateSetting('keyboard', 'heightRatio', $event)
        "
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.range"
        :label="t('waterfallPiano.keyboardRange')"
        :options="keyboardRangeOptions"
        @update:model-value="store.updateSetting('keyboard', 'range', $event)"
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.keyLabel"
        :label="t('waterfallPiano.keyLabel')"
        :options="keyLabelOptions"
        @update:model-value="
          store.updateSetting('keyboard', 'keyLabel', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.whiteKeyColor"
        :label="t('waterfallPiano.whiteKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'whiteKeyColor', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.blackKeyColor"
        :label="t('waterfallPiano.blackKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'blackKeyColor', $event)
        "
      />
      <SettingsColorPicker
        :model-value="store.settings.keyboard.pressedKeyColor"
        :label="t('waterfallPiano.pressedKeyColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'pressedKeyColor', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.keyboard.keyCornerRadius"
        :label="t('waterfallPiano.keyCornerRadius')"
        :min="0"
        :max="10"
        :step="1"
        @update:model-value="
          store.updateSetting('keyboard', 'keyCornerRadius', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.keyboard.keyBorderWidth"
        :label="t('waterfallPiano.keyBorderWidth')"
        :min="0"
        :max="4"
        :step="0.5"
        @update:model-value="
          store.updateSetting('keyboard', 'keyBorderWidth', $event)
        "
      />
      <SettingsColorPicker
        v-if="store.settings.keyboard.keyBorderWidth > 0"
        :model-value="store.settings.keyboard.keyBorderColor"
        :label="t('waterfallPiano.keyBorderColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'keyBorderColor', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.keyboard.separatorEnabled"
        :label="t('waterfallPiano.keyboardSeparator')"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorEnabled', $event)
        "
      />
      <SettingsColorPicker
        v-if="store.settings.keyboard.separatorEnabled"
        :model-value="store.settings.keyboard.separatorColor"
        :label="t('waterfallPiano.separatorColor')"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorColor', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.keyboard.separatorEnabled"
        :model-value="store.settings.keyboard.separatorThickness"
        :label="t('waterfallPiano.separatorThickness')"
        :min="1"
        :max="8"
        :step="1"
        @update:model-value="
          store.updateSetting('keyboard', 'separatorThickness', $event)
        "
      />

      <!-- 五线谱指示器 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.advancedKeyboard") }}
      </div>
      <SettingsToggle
        :model-value="store.settings.keyboard.staffVisible"
        :label="t('waterfallPiano.staffVisible')"
        @update:model-value="
          store.updateSetting('keyboard', 'staffVisible', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.keyboard.showNoteNames"
        :label="t('waterfallPiano.showNoteNames')"
        @update:model-value="
          store.updateSetting('keyboard', 'showNoteNames', $event)
        "
      />
      <SettingsSelect
        :model-value="store.settings.keyboard.synthesiaFlowDirection"
        :label="t('waterfallPiano.flowDirection')"
        :options="flowDirectionOptions"
        @update:model-value="
          store.updateSetting('keyboard', 'synthesiaFlowDirection', $event)
        "
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('keyboard')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 音频设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.audio')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.audio.preset"
        :label="t('waterfallPiano.audioPreset')"
        :options="audioPresetOptions"
        @update:model-value="store.updateSetting('audio', 'preset', $event)"
      />
      <SettingsRange
        :model-value="store.settings.audio.volume"
        :label="t('waterfallPiano.volume')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="store.updateSetting('audio', 'volume', $event)"
      />
      <SettingsRange
        :model-value="store.settings.audio.reverbAmount"
        :label="t('waterfallPiano.reverbAmount')"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="
          store.updateSetting('audio', 'reverbAmount', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.audio.sustain"
        :label="t('waterfallPiano.sustain')"
        @update:model-value="store.updateSetting('audio', 'sustain', $event)"
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('audio')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 背景设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.background')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.background.type"
        :label="t('waterfallPiano.backgroundType')"
        :options="backgroundTypeOptions"
        @update:model-value="store.updateSetting('background', 'type', $event)"
      />
      <SettingsColorPicker
        v-if="store.settings.background.type === 'solid'"
        :model-value="store.settings.background.solidColor"
        :label="t('waterfallPiano.backgroundColor')"
        @update:model-value="
          store.updateSetting('background', 'solidColor', $event)
        "
      />
      <SettingsSelect
        v-if="store.settings.background.type === 'preset'"
        :model-value="store.settings.background.presetTheme"
        :label="t('waterfallPiano.presetTheme')"
        :options="presetThemeOptions"
        @update:model-value="
          store.updateSetting('background', 'presetTheme', $event)
        "
      />
      <SettingsSelect
        v-if="store.settings.background.type === 'gradient'"
        :model-value="store.settings.background.gradientDirection"
        :label="t('waterfallPiano.gradientDirection')"
        :options="gradientDirectionOptions"
        @update:model-value="
          store.updateSetting('background', 'gradientDirection', $event)
        "
      />

      <!-- 自定义图片背景 -->
      <template v-if="store.settings.background.type === 'image'">
        <div class="form-control w-full">
          <label class="label py-1">
            <span class="label-text text-xs">{{
              t("waterfallPiano.uploadImage")
            }}</span>
          </label>
          <input
            type="file"
            accept="image/*"
            class="file-input file-input-bordered file-input-xs w-full"
            @change="onBackgroundImageUpload"
          />
        </div>
        <button
          v-if="store.settings.background.imageFile"
          class="btn btn-xs btn-ghost w-full"
          @click="store.updateSetting('background', 'imageFile', '')"
        >
          {{ t("waterfallPiano.clearImage") }}
        </button>
        <SettingsSelect
          :model-value="store.settings.background.imageFitMode"
          :label="t('waterfallPiano.imageFitMode')"
          :options="imageFitModeOptions"
          @update:model-value="
            store.updateSetting('background', 'imageFitMode', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.background.imageDarken"
          :label="t('waterfallPiano.imageDarken')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('background', 'imageDarken', $event)
          "
        />
      </template>

      <!-- 高级背景效果 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.advancedBackground") }}
      </div>

      <!-- 星空粒子 -->
      <SettingsToggle
        :model-value="store.settings.background.starfieldEnabled"
        :label="t('waterfallPiano.starfieldEnabled')"
        @update:model-value="
          store.updateSetting('background', 'starfieldEnabled', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.background.starfieldEnabled"
        :model-value="store.settings.background.starfieldDensity"
        :label="t('waterfallPiano.starfieldDensity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('background', 'starfieldDensity', $event)
        "
      />

      <!-- 流体模拟 -->
      <SettingsToggle
        :model-value="store.settings.background.fluidEnabled"
        :label="t('waterfallPiano.fluidEnabled')"
        @update:model-value="
          store.updateSetting('background', 'fluidEnabled', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.background.fluidEnabled"
        :model-value="store.settings.background.fluidResolution"
        :label="t('waterfallPiano.fluidResolution')"
        :min="0.25"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('background', 'fluidResolution', $event)
        "
      />

      <!-- 渐变流动动画 -->
      <SettingsToggle
        :model-value="store.settings.background.flowAnimation"
        :label="t('waterfallPiano.flowAnimation')"
        @update:model-value="
          store.updateSetting('background', 'flowAnimation', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.background.flowAnimation"
        :model-value="store.settings.background.flowSpeed"
        :label="t('waterfallPiano.flowSpeed')"
        :min="0.1"
        :max="3"
        :step="0.1"
        @update:model-value="
          store.updateSetting('background', 'flowSpeed', $event)
        "
      />

      <!-- 分组重置 -->
      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('background')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 后处理设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.postProcessing')"
      :default-open="false"
    >
      <!-- Bloom -->
      <SettingsToggle
        :model-value="store.settings.postProcessing.bloom.enabled"
        :label="t('waterfallPiano.bloom')"
        @update:model-value="
          store.updateSetting('postProcessing', 'bloom', {
            ...store.settings.postProcessing.bloom,
            enabled: $event,
          })
        "
      />
      <template v-if="store.settings.postProcessing.bloom.enabled">
        <SettingsRange
          :model-value="store.settings.postProcessing.bloom.intensity"
          :label="t('waterfallPiano.bloomIntensity')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('postProcessing', 'bloom', {
              ...store.settings.postProcessing.bloom,
              intensity: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.postProcessing.bloom.threshold"
          :label="t('waterfallPiano.bloomThreshold')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('postProcessing', 'bloom', {
              ...store.settings.postProcessing.bloom,
              threshold: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.postProcessing.bloom.radius"
          :label="t('waterfallPiano.bloomRadius')"
          :min="1"
          :max="20"
          :step="1"
          @update:model-value="
            store.updateSetting('postProcessing', 'bloom', {
              ...store.settings.postProcessing.bloom,
              radius: $event,
            })
          "
        />
        <SettingsToggle
          :model-value="store.settings.postProcessing.bloom.multiPass"
          :label="t('waterfallPiano.bloomMultiPass')"
          @update:model-value="
            store.updateSetting('postProcessing', 'bloom', {
              ...store.settings.postProcessing.bloom,
              multiPass: $event,
            })
          "
        />
      </template>

      <!-- Motion Blur -->
      <SettingsToggle
        :model-value="store.settings.postProcessing.motionBlur.enabled"
        :label="t('waterfallPiano.motionBlur')"
        @update:model-value="
          store.updateSetting('postProcessing', 'motionBlur', {
            ...store.settings.postProcessing.motionBlur,
            enabled: $event,
          })
        "
      />
      <SettingsRange
        v-if="store.settings.postProcessing.motionBlur.enabled"
        :model-value="store.settings.postProcessing.motionBlur.strength"
        :label="t('waterfallPiano.motionBlurStrength')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('postProcessing', 'motionBlur', {
            ...store.settings.postProcessing.motionBlur,
            strength: $event,
          })
        "
      />
      <SettingsToggle
        v-if="store.settings.postProcessing.motionBlur.enabled"
        :model-value="store.settings.postProcessing.motionBlur.layerOnly"
        :label="t('waterfallPiano.motionBlurLayerOnly')"
        @update:model-value="
          store.updateSetting('postProcessing', 'motionBlur', {
            ...store.settings.postProcessing.motionBlur,
            layerOnly: $event,
          })
        "
      />

      <!-- Chromatic Aberration -->
      <SettingsToggle
        :model-value="store.settings.postProcessing.chromaticAberration.enabled"
        :label="t('waterfallPiano.chromaticAberration')"
        @update:model-value="
          store.updateSetting('postProcessing', 'chromaticAberration', {
            ...store.settings.postProcessing.chromaticAberration,
            enabled: $event,
          })
        "
      />
      <SettingsRange
        v-if="store.settings.postProcessing.chromaticAberration.enabled"
        :model-value="
          store.settings.postProcessing.chromaticAberration.intensity
        "
        :label="t('waterfallPiano.chromaticAberrationIntensity')"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="
          store.updateSetting('postProcessing', 'chromaticAberration', {
            ...store.settings.postProcessing.chromaticAberration,
            intensity: $event,
          })
        "
      />

      <!-- Vignette -->
      <SettingsToggle
        :model-value="store.settings.postProcessing.vignette.enabled"
        :label="t('waterfallPiano.vignette')"
        @update:model-value="
          store.updateSetting('postProcessing', 'vignette', {
            ...store.settings.postProcessing.vignette,
            enabled: $event,
          })
        "
      />
      <template v-if="store.settings.postProcessing.vignette.enabled">
        <SettingsRange
          :model-value="store.settings.postProcessing.vignette.intensity"
          :label="t('waterfallPiano.vignetteIntensity')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('postProcessing', 'vignette', {
              ...store.settings.postProcessing.vignette,
              intensity: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.postProcessing.vignette.radius"
          :label="t('waterfallPiano.vignetteRadius')"
          :min="0.1"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('postProcessing', 'vignette', {
              ...store.settings.postProcessing.vignette,
              radius: $event,
            })
          "
        />
      </template>

      <!-- 命中线 Shader 泛光 -->
      <div class="divider text-xs text-base-content/50 my-1">
        {{ t("waterfallPiano.hitLineShaderGlow") }}
      </div>
      <SettingsToggle
        :model-value="store.settings.postProcessing.hitLineGlow.enabled"
        :label="t('waterfallPiano.hitLineGlowEnabled')"
        @update:model-value="
          store.updateSetting('postProcessing', 'hitLineGlow', {
            ...store.settings.postProcessing.hitLineGlow,
            enabled: $event,
          })
        "
      />
      <template v-if="store.settings.postProcessing.hitLineGlow.enabled">
        <SettingsRange
          :model-value="store.settings.postProcessing.hitLineGlow.intensity"
          :label="t('waterfallPiano.hitLineGlowShaderIntensity')"
          :min="0"
          :max="2"
          :step="0.05"
          @update:model-value="
            store.updateSetting('postProcessing', 'hitLineGlow', {
              ...store.settings.postProcessing.hitLineGlow,
              intensity: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.postProcessing.hitLineGlow.radius"
          :label="t('waterfallPiano.hitLineGlowShaderRadius')"
          :min="1"
          :max="50"
          :step="1"
          @update:model-value="
            store.updateSetting('postProcessing', 'hitLineGlow', {
              ...store.settings.postProcessing.hitLineGlow,
              radius: $event,
            })
          "
        />
      </template>

      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('postProcessing')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 音符块纹理设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.noteTextures')"
      :default-open="false"
    >
      <SettingsSelect
        :model-value="store.settings.noteTexture.preset"
        :label="t('waterfallPiano.texturePreset')"
        :options="texturePresetOptions"
        @update:model-value="
          store.updateSetting('noteTexture', 'preset', $event)
        "
      />
      <template v-if="store.settings.noteTexture.preset !== 'none'">
        <SettingsRange
          :model-value="store.settings.noteTexture.scale"
          :label="t('waterfallPiano.textureScale')"
          :min="0.5"
          :max="3"
          :step="0.1"
          @update:model-value="
            store.updateSetting('noteTexture', 'scale', $event)
          "
        />
        <SettingsRange
          :model-value="store.settings.noteTexture.intensity"
          :label="t('waterfallPiano.textureIntensity')"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('noteTexture', 'intensity', $event)
          "
        />
      </template>

      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('noteTexture')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 音符块粒子设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.noteBlockParticles')"
      :default-open="false"
    >
      <!-- 表面散发 -->
      <SettingsToggle
        :model-value="store.settings.noteBlockParticles.surfaceEmission.enabled"
        :label="t('waterfallPiano.surfaceEmission')"
        @update:model-value="
          store.updateSetting('noteBlockParticles', 'surfaceEmission', {
            ...store.settings.noteBlockParticles.surfaceEmission,
            enabled: $event,
          })
        "
      />
      <template
        v-if="store.settings.noteBlockParticles.surfaceEmission.enabled"
      >
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.surfaceEmission.rate"
          :label="t('waterfallPiano.surfaceEmissionRate')"
          :min="0.05"
          :max="1"
          :step="0.05"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'surfaceEmission', {
              ...store.settings.noteBlockParticles.surfaceEmission,
              rate: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.surfaceEmission.speed"
          :label="t('waterfallPiano.surfaceEmissionSpeed')"
          :min="0.2"
          :max="5"
          :step="0.2"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'surfaceEmission', {
              ...store.settings.noteBlockParticles.surfaceEmission,
              speed: $event,
            })
          "
        />
        <SettingsRange
          :model-value="
            store.settings.noteBlockParticles.surfaceEmission.lifetime
          "
          :label="t('waterfallPiano.surfaceEmissionLifetime')"
          :min="5"
          :max="80"
          :step="5"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'surfaceEmission', {
              ...store.settings.noteBlockParticles.surfaceEmission,
              lifetime: $event,
            })
          "
        />
      </template>

      <!-- 命中爆炸增强 -->
      <SettingsToggle
        :model-value="store.settings.noteBlockParticles.hitExplosion.enabled"
        :label="t('waterfallPiano.hitExplosionEnhanced')"
        @update:model-value="
          store.updateSetting('noteBlockParticles', 'hitExplosion', {
            ...store.settings.noteBlockParticles.hitExplosion,
            enabled: $event,
          })
        "
      />
      <template v-if="store.settings.noteBlockParticles.hitExplosion.enabled">
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.hitExplosion.count"
          :label="t('waterfallPiano.hitExplosionCount')"
          :min="4"
          :max="40"
          :step="2"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'hitExplosion', {
              ...store.settings.noteBlockParticles.hitExplosion,
              count: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.hitExplosion.speed"
          :label="t('waterfallPiano.hitExplosionSpeed')"
          :min="1"
          :max="12"
          :step="0.5"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'hitExplosion', {
              ...store.settings.noteBlockParticles.hitExplosion,
              speed: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.hitExplosion.lifetime"
          :label="t('waterfallPiano.hitExplosionLifetime')"
          :min="5"
          :max="80"
          :step="5"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'hitExplosion', {
              ...store.settings.noteBlockParticles.hitExplosion,
              lifetime: $event,
            })
          "
        />
      </template>

      <!-- 环绕粒子 -->
      <SettingsToggle
        :model-value="store.settings.noteBlockParticles.orbiting.enabled"
        :label="t('waterfallPiano.orbitingParticles')"
        @update:model-value="
          store.updateSetting('noteBlockParticles', 'orbiting', {
            ...store.settings.noteBlockParticles.orbiting,
            enabled: $event,
          })
        "
      />
      <template v-if="store.settings.noteBlockParticles.orbiting.enabled">
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.orbiting.count"
          :label="t('waterfallPiano.orbitingCount')"
          :min="1"
          :max="12"
          :step="1"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'orbiting', {
              ...store.settings.noteBlockParticles.orbiting,
              count: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.orbiting.radius"
          :label="t('waterfallPiano.orbitingRadius')"
          :min="3"
          :max="30"
          :step="1"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'orbiting', {
              ...store.settings.noteBlockParticles.orbiting,
              radius: $event,
            })
          "
        />
        <SettingsRange
          :model-value="store.settings.noteBlockParticles.orbiting.speed"
          :label="t('waterfallPiano.orbitingSpeed')"
          :min="0.5"
          :max="5"
          :step="0.2"
          @update:model-value="
            store.updateSetting('noteBlockParticles', 'orbiting', {
              ...store.settings.noteBlockParticles.orbiting,
              speed: $event,
            })
          "
        />
      </template>

      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('noteBlockParticles')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 性能设置 -->
    <SettingsCollapse
      :title="t('waterfallPiano.settingsGroups.performance')"
      :default-open="false"
    >
      <SettingsRange
        :model-value="store.settings.performance.particleHardLimit"
        :label="t('waterfallPiano.particleHardLimit')"
        :min="100"
        :max="2000"
        :step="100"
        @update:model-value="
          store.updateSetting('performance', 'particleHardLimit', $event)
        "
      />
      <SettingsToggle
        :model-value="store.settings.performance.autoDegrade"
        :label="t('waterfallPiano.autoDegrade')"
        @update:model-value="
          store.updateSetting('performance', 'autoDegrade', $event)
        "
      />
      <SettingsRange
        v-if="store.settings.performance.autoDegrade"
        :model-value="store.settings.performance.minFps"
        :label="t('waterfallPiano.minFps')"
        :min="15"
        :max="60"
        :step="5"
        @update:model-value="
          store.updateSetting('performance', 'minFps', $event)
        "
      />
      <SettingsRange
        :model-value="store.settings.performance.targetFps"
        :label="t('waterfallPiano.targetFps')"
        :min="30"
        :max="120"
        :step="5"
        @update:model-value="
          store.updateSetting('performance', 'targetFps', $event)
        "
      />

      <button
        class="btn btn-xs btn-ghost w-full mt-2"
        @click="store.resetGroup('performance')"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </SettingsCollapse>

    <!-- 全局重置按钮 -->
    <div class="pt-2">
      <button
        class="btn btn-sm btn-ghost w-full"
        @click="store.resetSettings()"
      >
        {{ t("common.resetAllToDefaults") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";
import { ThemeSystem } from "../engine/ThemeSystem";
import type {
  VisualThemeId,
  ParticlePresetId,
  StyleParameters,
} from "../types";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsColorPicker,
} from "@/components/Settings";

const { t } = useI18n();
const store = useWaterfallPianoStore();

const themeFileInput = ref<HTMLInputElement | null>(null);

const visualStyleOptions = [
  { label: t("waterfallPiano.styles.blocks"), value: "blocks" },
  { label: t("waterfallPiano.styles.particles"), value: "particles" },
  { label: t("waterfallPiano.styles.hybrid"), value: "hybrid" },
];

const keyboardRangeOptions = [
  { label: "88", value: "88" },
  { label: "61", value: "61" },
  { label: "49", value: "49" },
  { label: t("waterfallPiano.custom"), value: "custom" },
];

const keyLabelOptions = [
  { label: t("waterfallPiano.keyLabels.none"), value: "none" },
  { label: t("waterfallPiano.keyLabels.note"), value: "note" },
  { label: t("waterfallPiano.keyLabels.pitchClass"), value: "pitchClass" },
  { label: t("waterfallPiano.keyLabels.octave"), value: "octave" },
];

const audioPresetOptions = [
  { label: t("waterfallPiano.presets.grandPiano"), value: "grand-piano" },
  { label: t("waterfallPiano.presets.electricPiano"), value: "electric-piano" },
  { label: t("waterfallPiano.presets.brightPiano"), value: "bright-piano" },
  { label: t("waterfallPiano.presets.mellowPiano"), value: "mellow-piano" },
  { label: t("waterfallPiano.presets.organ"), value: "organ" },
  { label: t("waterfallPiano.presets.synthPad"), value: "synth-pad" },
];

const particleShapeOptions = [
  { label: t("waterfallPiano.shapes.circle"), value: "circle" },
  { label: t("waterfallPiano.shapes.square"), value: "square" },
  { label: t("waterfallPiano.shapes.note"), value: "note" },
  { label: t("waterfallPiano.shapes.star"), value: "star" },
];

const colorSchemeOptions = [
  { label: t("waterfallPiano.colorSchemes.pitch"), value: "pitch" },
  { label: t("waterfallPiano.colorSchemes.hands"), value: "hands" },
  { label: t("waterfallPiano.colorSchemes.rainbow"), value: "rainbow" },
  { label: t("waterfallPiano.colorSchemes.warm"), value: "warm" },
  { label: t("waterfallPiano.colorSchemes.cool"), value: "cool" },
  { label: t("waterfallPiano.colorSchemes.neon"), value: "neon" },
  { label: t("waterfallPiano.colorSchemes.custom"), value: "custom" },
];

const hitLineStyleOptions = [
  { label: t("waterfallPiano.hitLineStyles.solid"), value: "solid" },
  { label: t("waterfallPiano.hitLineStyles.dashed"), value: "dashed" },
  { label: t("waterfallPiano.hitLineStyles.dotted"), value: "dotted" },
];

const backgroundTypeOptions = [
  { label: t("waterfallPiano.bgTypes.solid"), value: "solid" },
  { label: t("waterfallPiano.bgTypes.gradient"), value: "gradient" },
  { label: t("waterfallPiano.bgTypes.preset"), value: "preset" },
  { label: t("waterfallPiano.bgTypes.image"), value: "image" },
  { label: t("waterfallPiano.bgTypes.stars"), value: "stars" },
  { label: t("waterfallPiano.bgTypes.fluid"), value: "fluid" },
];

const presetThemeOptions = [
  { label: t("waterfallPiano.themes.nightSky"), value: "night-sky" },
  { label: t("waterfallPiano.themes.ocean"), value: "ocean" },
  { label: t("waterfallPiano.themes.sunset"), value: "sunset" },
  { label: t("waterfallPiano.themes.aurora"), value: "aurora" },
  { label: t("waterfallPiano.themes.forest"), value: "forest" },
];

const imageFitModeOptions = [
  { label: t("waterfallPiano.imageFitModes.cover"), value: "cover" },
  { label: t("waterfallPiano.imageFitModes.stretch"), value: "stretch" },
  { label: t("waterfallPiano.imageFitModes.center"), value: "center" },
  { label: t("waterfallPiano.imageFitModes.tile"), value: "tile" },
];

const texturePresetOptions = [
  { label: t("waterfallPiano.texturePresets.none"), value: "none" },
  { label: t("waterfallPiano.texturePresets.noise"), value: "noise" },
  { label: t("waterfallPiano.texturePresets.stripes"), value: "stripes" },
  { label: t("waterfallPiano.texturePresets.dots"), value: "dots" },
  { label: t("waterfallPiano.texturePresets.glow"), value: "glow" },
  { label: t("waterfallPiano.texturePresets.metallic"), value: "metallic" },
];

const gradientDirectionOptions = [
  {
    label: t("waterfallPiano.gradientDirections.vertical"),
    value: "linear-vertical",
  },
  {
    label: t("waterfallPiano.gradientDirections.horizontal"),
    value: "linear-horizontal",
  },
  { label: t("waterfallPiano.gradientDirections.radial"), value: "radial" },
];

const flowDirectionOptions = [
  { label: t("waterfallPiano.directions.down"), value: "down" },
  { label: t("waterfallPiano.directions.up"), value: "up" },
];

const themeSystem = new ThemeSystem();

const availableThemes = computed(() => themeSystem.getAvailableThemes());

const particlePresetOptions = computed(() =>
  themeSystem.getAvailableParticlePresets().map((p) => ({
    label: t(p.labelKey),
    value: p.id,
  })),
);

function applyTheme(themeId: VisualThemeId) {
  store.settings = themeSystem.applyTheme(themeId, store.settings);
}

function applyParticlePreset(presetId: ParticlePresetId) {
  store.settings = themeSystem.applyParticlePreset(presetId, store.settings);
}

function updateStyleParam(key: keyof StyleParameters, value: number) {
  const params = { ...store.settings.theme.styleParameters, [key]: value };
  store.settings = themeSystem.applyStyleParameters(params, store.settings);
}

function exportTheme() {
  const preset = themeSystem.exportTheme(`theme-${Date.now()}`, store.settings);
  const json = themeSystem.serializeTheme(preset);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${preset.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importTheme() {
  themeFileInput.value?.click();
}

function onThemeFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = e.target?.result as string;
      const preset = themeSystem.deserializeTheme(json);
      store.settings = themeSystem.importTheme(preset, store.settings);
    } catch (err) {
      console.error("Failed to import theme:", err);
    }
  };
  reader.readAsText(file);
  // 重置 input 以允许重复选择同一文件
  input.value = "";
}

function onBackgroundImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    store.updateSetting("background", "imageFile", dataUrl);
  };
  reader.readAsDataURL(file);
}
</script>
