---
title: 'ViMag: A Visual Vibration Analysis Toolbox'
tags:
  - deep-learning
  - modal analysis
  - condition monitoring
  - structural health monitoring
  - motion magnification
authors:
  - name: Ricard Lado-Roigé
    orcid: 0000-0002-6421-7351
    equal-contrib: true
    affiliation: "1"
  - name: Marco A. Pérez
    orcid: 0000-0003-4140-1823
    corresponding: true
    affiliation: "1"
affiliations:
 - name: IQS School of Engineering, Universitat Ramon Llull, Via Augusta 390, 08017 Barcelona, Spain
   index: 1
date: 28 November 2022
bibliography: paper.bib
---

# Summary

Recent developments in computer vision have brought about a new set of techniques called Video Motion Magnification, that are capable of identifying and magnifying eye-imperceptible movements in video data. These techniques have proved effective in applications, such as producing visual representations of an object’s operating deflection shapes or recovering sound from a room behind soundproof glass. Our research explores the new possibilities of motion magnification applied to Structural Health Monitoring (SHM) and vibration testing, harnessing the latest advances in deep learning to achieve state-of-the-art results.

Vision-based damage detection techniques can reduce sensor deployment costs while providing accurate, useful, and full-field readings of structural behaviour. We present a new video processing approach that allows the treatment of video data to obtain vibrational signatures of complex structures. Therefore, enabling the identification of very light structural damage in a controlled lab environment [@LADOROIGE2022112218]. The presented software approach is based on the use of state-of-the-art deep learning video motion magnification techniques. Motion magnification acts like a microscope for motion, magnifying tiny movements on video sequences, to retrieve seemingly invisible or almost imperceptible movements. Consequently, motion magnification may allow the naked eye to see a structure’s operating deflection shapes as they happened in real operating conditions. The presented vision-based technique offers an easy to use, effective, full-field tool for SHM at a fraction of the cost of contact-based techniques.


# Statement of need

ViMag provides an easy to use graphical user interface aimed at extracting timeseries signals of vibrating machinery and structure's videos. This software enables the visualization of videos, selection of magnification area, and signal processing. Consequently, facilitates and automates the technique developed in [@LADOROIGE2022112218] and allows machine learning layman to obtain reliable results without having to apply a manual multistage image processing pipeline.

![Video sequence to signal process using motion magnification](pipeline_chart.png){ width=90% }

The intended use of ViMag is to support the assesment of mechanichal system's performance such as machines or stuctures. This software enables the use of a camera as a fuctional replacement for an accelerometer, by employing STB-VMM [@lado2022_STB-VMM] as the motion magnification backend. However, the use for ViMag might not be constrained to mechanical engineering exclusively and some other interesting applications could also benefit from the software, such as some medical applications or technical demos such as recovering sound from video [cite].

Reaserchers and engineers should consider employing condition monitoring or SHM methodologies [cita pymodal] on the readings obtained using ViMag. Such techniques are defined as the set of analysis and assessment tools applied to autonomously determine the integrity and durability of engineering structures. These techniques are aimed at track the operational status, assess the condition, and alert to the changes in the geometric or material properties that can affect a structure's overall performance, safety, reliability, and operational life [@frangopol_effects_1987, @cosenza_damage_2000] [cita font?].


# Related Work

This work is based on the method developed by [@LADOROIGE2022112218] for vibration-based damage detection and [@lado2022_STB-VMM] Swin Transformer Based Video Motion Magnification, which improves on the previous motion magnification backend [Oh] in terms of image quality.

Other reaserchers have used similar techniques for vibration testing [cites], however non have released a software tool to go along with their publications. ViMag hopes to provide a simple interface to replicate some of these experiments using state-of-the-art learning-based video motion magnification.


# Acknowledgements

The authors would like to gratefully acknowledge the support and funding of the Catalan Agency for Business
Competitiveness (ACCIÓ) through the project INNOTEC ISAPREF 2021. Additionally, the first author would like to
acknowledge a Doctoral Scholarship from IQS.


# References