<script setup lang="ts">
import { RuiButton, RuiButtonGroup, RuiIcon } from '@rotki/ui-library';

const message = 'put your changes here';
</script>

<template>
  <VContainer>
    <div>{{ message }}</div>
    <!-- insert components to be tested here -->
    <RuiButtonGroup>
      <RuiButton>{{ message }}</RuiButton>
      <RuiButton>{{ message }}</RuiButton>
    </RuiButtonGroup>
    <RuiButton>{{ message }}</RuiButton>
    <RuiIcon name="4k-line" :size="50" />
  </VContainer>
</template>
