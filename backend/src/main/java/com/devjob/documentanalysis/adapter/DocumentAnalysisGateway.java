package com.devjob.documentanalysis.adapter;

public interface DocumentAnalysisGateway {
    boolean available();
    String analyze(String documentType, String redactedContent);
}
